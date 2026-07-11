use futures_util::future::join_all;
use hickory_resolver::TokioResolver;
use hickory_resolver::config::{NameServerConfig, ResolverConfig, ResolverOpts};
use hickory_resolver::net::runtime::TokioRuntimeProvider;
use hickory_resolver::net::{DnsError, NetError};
use hickory_resolver::proto::op::ResponseCode;
use hickory_resolver::proto::rr::RecordType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

const DEFAULT_DNS: &str = "1.1.1.1";
const MAX_RESOLVER_CACHE: usize = 20;

pub struct ResolverCache {
    default: Arc<TokioResolver>,
    cache: Mutex<HashMap<String, Arc<TokioResolver>>>,
}

impl ResolverCache {
    pub fn new() -> Self {
        Self {
            default: Arc::new(
                build_resolver_for_ip(DEFAULT_DNS.parse().expect("valid default IP"))
                    .expect("failed to build default resolver"),
            ),
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, dns_server: Option<&str>) -> Result<Arc<TokioResolver>, String> {
        let key = dns_server.unwrap_or(DEFAULT_DNS).trim();
        if key.is_empty() {
            return Ok(self.default.clone());
        }

        key.parse::<IpAddr>()
            .map_err(|_| format!("Invalid DNS server address: {key}"))?;

        if key == DEFAULT_DNS {
            return Ok(self.default.clone());
        }

        let mut cache = self.cache.lock().expect("resolver cache lock");
        if let Some(resolver) = cache.get(key) {
            return Ok(resolver.clone());
        }

        let ip: IpAddr = key.parse().expect("validated above");
        let resolver = Arc::new(
            build_resolver_for_ip(ip).map_err(|e| format!("Failed to configure resolver: {e}"))?,
        );

        if cache.len() >= MAX_RESOLVER_CACHE {
            if let Some(oldest) = cache.keys().next().cloned() {
                cache.remove(&oldest);
            }
        }
        cache.insert(key.to_string(), resolver.clone());
        Ok(resolver)
    }
}

fn build_resolver_for_ip(ip: IpAddr) -> Result<TokioResolver, String> {
    let mut config = ResolverConfig::from_parts(None, vec![], vec![]);
    config.add_name_server(NameServerConfig::udp_and_tcp(ip));

    let mut builder =
        TokioResolver::builder_with_config(config, TokioRuntimeProvider::default());
    *builder.options_mut() = ResolverOpts::default();
    builder.build().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct DnsRequest {
    pub domain: String,
    pub record_types: Vec<String>,
    pub dns_server: Option<String>,
}

#[derive(Serialize)]
pub struct DnsResponse {
    pub domain: String,
    pub results: Vec<RecordResult>,
}

#[derive(Serialize)]
pub struct RecordResult {
    pub record_type: String,
    pub records: Vec<String>,
    pub error: Option<String>,
}

async fn resolve_one(resolver: &TokioResolver, domain: &str, r_type_str: String) -> RecordResult {
    let record_type = match RecordType::from_str(&r_type_str.to_uppercase()) {
        Ok(rt) => rt,
        Err(_) => {
            return RecordResult {
                record_type: r_type_str.clone(),
                records: vec![],
                error: Some(format!(
                    "\"{r_type_str}\" is not a supported DNS record type."
                )),
            };
        }
    };

    match resolver.lookup(domain, record_type).await {
        Ok(lookup) => {
            let records = lookup
                .answers()
                .iter()
                .map(|r| r.data.to_string())
                .collect();
            RecordResult {
                record_type: r_type_str,
                records,
                error: None,
            }
        }
        Err(err) => lookup_error_result(domain, &r_type_str, err),
    }
}

fn lookup_error_result(domain: &str, record_type: &str, err: NetError) -> RecordResult {
    if let NetError::Dns(DnsError::NoRecordsFound(no_records)) = &err {
        return match no_records.response_code {
            ResponseCode::NXDomain => RecordResult {
                record_type: record_type.to_string(),
                records: vec![],
                error: Some(format!("The domain \"{domain}\" does not exist.")),
            },
            ResponseCode::NoError => RecordResult {
                record_type: record_type.to_string(),
                records: vec![],
                error: None,
            },
            _ => RecordResult {
                record_type: record_type.to_string(),
                records: vec![],
                error: Some(format!(
                    "No {record_type} records are published for \"{domain}\"."
                )),
            },
        };
    }

    let message = match err {
        NetError::Timeout => {
            "The lookup timed out. Try again or choose a different resolver.".to_string()
        }
        NetError::Dns(DnsError::ResponseCode(code)) => match code {
            ResponseCode::ServFail => {
                "The resolver returned a temporary error. Try again.".to_string()
            }
            ResponseCode::Refused => {
                "The resolver refused this query.".to_string()
            }
            _ => format!("The resolver returned an error ({code})."),
        },
        _ => err.to_string(),
    };

    RecordResult {
        record_type: record_type.to_string(),
        records: vec![],
        error: Some(message),
    }
}

pub async fn resolve_dns(resolver: &TokioResolver, req: DnsRequest) -> DnsResponse {
    let futures = req
        .record_types
        .into_iter()
        .map(|r_type_str| resolve_one(resolver, &req.domain, r_type_str));

    let results = join_all(futures).await;

    DnsResponse {
        domain: req.domain,
        results,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_and_dnssec_record_types() {
        for rt in [
            "A", "AAAA", "CNAME", "NS", "MX", "TXT", "SOA", "PTR", "SRV", "CAA",
            "DNSKEY", "DS", "RRSIG", "NSEC", "NSEC3", "NSEC3PARAM", "CDS", "CDNSKEY",
            "HTTPS", "SVCB", "TLSA", "SSHFP", "NAPTR", "HINFO", "CERT", "OPENPGPKEY",
            "SMIMEA", "KEY", "SIG", "ANAME", "CSYNC",
        ] {
            assert!(
                RecordType::from_str(rt).is_ok(),
                "expected {rt} to parse"
            );
        }
    }

    #[tokio::test]
    async fn resolves_dnskey_for_example_com() {
        let resolver = ResolverCache::new();
        let resolver = resolver.get(None).unwrap();
        let result = resolve_one(&resolver, "example.com", "DNSKEY".to_string()).await;
        assert!(result.error.is_none(), "DNSKEY lookup failed: {:?}", result.error);
        assert!(!result.records.is_empty(), "expected DNSKEY records");
    }

    #[tokio::test]
    async fn nxdomain_returns_friendly_message() {
        let resolver = ResolverCache::new();
        let resolver = resolver.get(None).unwrap();
        let result = resolve_one(
            &resolver,
            "this-domain-definitely-does-not-exist-xyz123.invalid",
            "A".to_string(),
        )
        .await;
        assert_eq!(
            result.error.as_deref(),
            Some("The domain \"this-domain-definitely-does-not-exist-xyz123.invalid\" does not exist.")
        );
    }

    #[tokio::test]
    async fn missing_record_type_is_not_an_error() {
        let resolver = ResolverCache::new();
        let resolver = resolver.get(None).unwrap();
        let result = resolve_one(&resolver, "example.com", "PTR".to_string()).await;
        assert!(result.error.is_none());
        assert!(result.records.is_empty());
    }

    #[tokio::test]
    async fn unsupported_type_message_is_clear() {
        let resolver = ResolverCache::new();
        let resolver = resolver.get(None).unwrap();
        let result = resolve_one(&resolver, "example.com", "NOTAREALTYPE".to_string()).await;
        assert_eq!(
            result.error.as_deref(),
            Some("\"NOTAREALTYPE\" is not a supported DNS record type.")
        );
    }
}
