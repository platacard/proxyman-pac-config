function FindProxyForURL(url, host) {
  host = host.toLowerCase();

  if (
    shExpMatch(host, "*beta.platacard.mx") ||
    shExpMatch(host, "*beta.plata.mx") ||
    shExpMatch(host, "*beta.plata.co") ||
    shExpMatch(host, "*beta.diftech.net") ||
    shExpMatch(host, "*sandbox.platacard.mx") ||
    shExpMatch(host, "mock*.beta.diftech.org")
  ) {
    return "PROXY {{PROXY}}; DIRECT";
  }

  return "DIRECT";
}
