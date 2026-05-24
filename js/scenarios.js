/* ============================================================
   Scenario Data — Public Path, Wildcard Fwd, Workspace Fwd
   ============================================================ */

// eslint-disable-next-line no-unused-vars
const SCENARIOS = {

  /* ----------------------------------------------------------
     Scenario 0 — Public Path (Baseline)
     ---------------------------------------------------------- */
  public: {
    id: 'public',
    title: 'Public Path (No PrivateLink)',
    overview:
      'Without PrivateLink, the on-prem client queries the corporate DNS server, which forwards or recurses through public DNS ' +
      'to resolve the workspace URL to a public IP address. Traffic from the client then traverses the internet to reach the ' +
      'Databricks control plane. This is the default configuration and requires no additional networking setup.',

    steps: [
      { id: 1, label: 'Client queries on-prem DNS',    detail: 'The client (browser or CLI) queries the <strong>corporate DNS server</strong> for <strong>my-wksp.cloud.databricks.com</strong>.' },
      { id: 2, label: 'Corporate DNS forwards to public DNS', detail: 'The corporate DNS server has no conditional forwarder for this domain, so it recurses or forwards to <strong>public DNS</strong> (e.g., ISP resolver, 8.8.8.8).' },
      { id: 3, label: 'Public DNS resolves to public IP', detail: 'Public DNS performs recursive resolution through the DNS hierarchy and returns a <strong>public IP address</strong> for the Databricks control plane back to the corporate DNS server.' },
      { id: 4, label: 'DNS response returns to client', detail: 'The corporate DNS server returns the public IP to the client.' },
      { id: 5, label: 'HTTPS connection over internet', detail: 'The client establishes a TLS connection to the public IP. Traffic traverses the <strong>public internet</strong> to reach the Databricks control plane.' },
      { id: 6, label: 'Databricks serves the request',  detail: 'The Databricks control plane terminates TLS and serves the workspace UI or API response.' },
    ],

    components: [
      { name: 'Client Device',             purpose: 'Originates DNS query and HTTPS request from on-prem',          config: 'Uses corporate DNS server for name resolution' },
      { name: 'Corporate DNS Server',       purpose: 'Receives client DNS queries; forwards to public DNS',          config: 'No conditional forwarder for cloud.databricks.com — resolves via standard recursion' },
      { name: 'Public DNS',                 purpose: 'Resolves my-wksp.cloud.databricks.com to a public IP',       config: 'Recursive resolver (ISP or public like 8.8.8.8)' },
      { name: 'Internet',                   purpose: 'Transport layer between on-prem client and Databricks',        config: 'No special configuration; standard outbound HTTPS (443)' },
      { name: 'Databricks Control Plane',   purpose: 'Hosts workspace UI and REST API',                              config: 'Public endpoint: my-wksp.cloud.databricks.com', link: 'https://docs.databricks.com/en/security/network/classic/privatelink.html' },
    ],

    configs: [
      {
        title: 'Verify Public Resolution',
        lang: 'bash',
        code:
`# Resolve workspace URL — should return a public IP
nslookup my-wksp.cloud.databricks.com

# Or with dig
dig +short my-wksp.cloud.databricks.com`,
      },
    ],

    // Diagram layout — see diagrams.js for rendering
    diagram: {
      zones: [
        { id: 'onprem', label: 'On-Premises Network', x: 20, y: 50, w: 190, h: 300, style: 'comp-box-onprem' },
        { id: 'internet', label: 'Internet / Public DNS', x: 310, y: 80, w: 260, h: 240, style: 'comp-box-internet' },
        { id: 'databricks', label: 'Databricks', x: 670, y: 50, w: 240, h: 300, style: 'comp-box-db' },
      ],
      nodes: [
        { id: 'client',   label: 'Client',              sub: 'Browser / CLI',                    x: 60,  y: 120, w: 110, h: 48, zone: 'onprem' },
        { id: 'corpdns',  label: 'Corporate DNS',        sub: 'No conditional fwd',               x: 60,  y: 270, w: 110, h: 48, zone: 'onprem' },
        { id: 'pubdns',   label: 'Public DNS',           sub: 'Recursive Resolver',               x: 380, y: 130, w: 120, h: 48, zone: 'internet' },
        { id: 'inet',     label: 'Internet',             sub: 'HTTPS over public internet',       x: 380, y: 250, w: 120, h: 48, zone: 'internet', style: 'comp-box-internet' },
        { id: 'cp',       label: 'Control Plane',        sub: 'my-wksp.cloud.databricks.com',   x: 725, y: 190, w: 140, h: 50, zone: 'databricks', style: 'comp-box-db' },
      ],
      connections: [
        { from: 'client',  to: 'corpdns', type: 'dns-query',    step: 1, label: 'DNS query' },
        { from: 'corpdns', to: 'pubdns',  type: 'dns-query',    step: 2, label: 'Forward / recurse' },
        { from: 'pubdns',  to: 'corpdns', type: 'dns-response', step: 3, label: 'Public IP' },
        { from: 'corpdns', to: 'client',  type: 'dns-response', step: 4, label: 'Public IP' },
        { from: 'client',  to: 'inet',    type: 'https',        step: 5, label: '' },
        { from: 'inet',    to: 'cp',      type: 'https',        step: 5, label: 'HTTPS :443' },
      ],
    },
  },

  /* ----------------------------------------------------------
     Scenario A — Wildcard DNS Forward
     ---------------------------------------------------------- */
  wildcard: {
    id: 'wildcard',
    title: 'On-Prem: Wildcard DNS Forwarding (*.cloud.databricks.com)',
    overview:
      'The on-premises DNS server is configured with a conditional forwarder for <code>*.cloud.databricks.com</code>, ' +
      'sending all Databricks DNS queries over Direct Connect or VPN to Route 53 Inbound Resolver endpoints in the customer VPC. ' +
      'Route 53 resolves the query via a Private Hosted Zone (<code>privatelink.cloud.databricks.com</code>), ' +
      'returning the private IP of the front-end VPCE via an A record for the region (e.g., <code>nvirginia.privatelink.cloud.databricks.com</code>). ' +
      'All traffic stays on private networks — nothing traverses the public internet.',

    useCase:
      'Best when all Databricks workspaces in a region require front-end PrivateLink and routing traffic for every workspace to the same VPCE is acceptable. ' +
      'This is the simplest front-end PrivateLink configuration — a single wildcard forwarding rule covers all current and future workspaces.',

    caveats: [
      'All <code>*.cloud.databricks.com</code> queries are forwarded to Route 53 regardless of region — every workspace DNS lookup traverses the private path even if the workspace is in a different region.',
      'Workspaces with no Private Access Settings (PAS) attached will resolve to a public IP, so traffic will traverse the public internet.',
      'Workspaces with back-end PrivateLink enabled will resolve to a private IP, since enabling back-end PrivateLink requires a PAS to be attached.',
    ],

    steps: [
      { id: 1, label: 'Client queries on-prem DNS',           detail: 'The client queries the corporate DNS server for <strong>my-wksp.cloud.databricks.com</strong>.' },
      { id: 2, label: 'Conditional forwarder matches',         detail: 'The corporate DNS server matches the query against the conditional forwarding rule for <strong>*.cloud.databricks.com</strong> and forwards it over <strong>Direct Connect / VPN</strong>.' },
      { id: 3, label: 'Route 53 Inbound Resolver receives query', detail: 'The DNS query arrives at the <strong>Route 53 Inbound Resolver endpoint</strong> ENIs in the customer VPC.' },
      { id: 4, label: 'Public CNAME redirects to privatelink domain', detail: 'Databricks public DNS returns a <strong>CNAME</strong> from <strong>my-wksp.cloud.databricks.com</strong> to <strong>&lt;region&gt;.privatelink.cloud.databricks.com</strong> (e.g., <code>nvirginia.privatelink.cloud.databricks.com</code>). This CNAME is what causes the query to match the Private Hosted Zone.' },
      { id: 5, label: 'Route 53 resolves via PHZ',             detail: 'Because the VPC has an associated PHZ for <strong>privatelink.cloud.databricks.com</strong>, Route 53 intercepts the CNAME target and resolves the <strong>A record</strong> for <strong>&lt;region&gt;.privatelink.cloud.databricks.com</strong>, returning the <strong>private IP</strong> of the front-end VPCE ENI.' },
      { id: 6, label: 'DNS response returns to client',        detail: 'The private IP address is returned back through the Inbound Resolver, over DX/VPN, through the corporate DNS server, to the client.' },
      { id: 7, label: 'HTTPS via VPCE to control plane',       detail: 'The client sends HTTPS traffic to the private IP. The request enters the VPC via DX/VPN, hits the <strong>front-end VPCE ENI</strong>, and is forwarded through the <strong>AWS PrivateLink</strong> tunnel to the Databricks control plane.' },
    ],

    components: [
      { name: 'Client Device',              purpose: 'Originates DNS query and HTTPS request from on-prem',        config: 'Uses corporate DNS server; routable to VPC via DX/VPN' },
      { name: 'Corporate DNS Server',        purpose: 'Forwards Databricks queries to Route 53 Inbound Resolver',   config: 'Conditional forwarder: *.cloud.databricks.com -> Inbound Resolver ENI IPs' },
      { name: 'Direct Connect / VPN',        purpose: 'Private network link between on-prem and AWS VPC',           config: 'Must allow DNS (UDP/TCP 53) and HTTPS (TCP 443)', link: 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html' },
      { name: 'Route 53 Inbound Resolver',   purpose: 'Receives forwarded DNS queries inside the VPC',              config: 'Inbound endpoint with ENIs in VPC subnets; security group allows port 53', link: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-getting-started.html' },
      { name: 'Route 53 Private Hosted Zone', purpose: 'Maps region hostname to VPCE private IP',                   config: 'Zone: privatelink.cloud.databricks.com; A record for &lt;region&gt;.privatelink.cloud.databricks.com pointing to VPCE ENI IP (e.g., nvirginia, ohio, frankfurt, tokyo)', link: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html' },
      { name: 'Front-End VPCE',              purpose: 'Interface endpoint providing private access to Databricks',   config: 'Service: com.amazonaws.vpce.&lt;region&gt;.databricks-workspace; ENI in VPC subnet', link: 'https://docs.databricks.com/en/security/network/classic/privatelink.html' },
      { name: 'Databricks Control Plane',    purpose: 'Hosts workspace UI and REST API',                            config: 'VPCE service on Databricks side; accessible via PrivateLink', link: 'https://docs.databricks.com/en/security/network/classic/privatelink.html' },
    ],

    configs: [
      {
        title: 'Route 53 Private Hosted Zone (Terraform)',
        lang: 'hcl',
        code:
`resource "aws_route53_zone" "databricks_phz" {
  name = "cloud.databricks.com"
  vpc {
    vpc_id = aws_vpc.main.id
  }
}

resource "aws_route53_record" "workspace" {
  zone_id = aws_route53_zone.databricks_phz.zone_id
  name    = "my-wksp.cloud.databricks.com"
  type    = "CNAME"
  ttl     = 300
  records = [
    aws_vpc_endpoint.databricks_fe.dns_entry[0]["dns_name"]
  ]
}`,
      },
      {
        title: 'Route 53 Inbound Resolver Endpoint (Terraform)',
        lang: 'hcl',
        code:
`resource "aws_route53_resolver_endpoint" "inbound" {
  name      = "databricks-inbound"
  direction = "INBOUND"

  security_group_ids = [aws_security_group.resolver_sg.id]

  ip_address {
    subnet_id = aws_subnet.private_a.id
  }
  ip_address {
    subnet_id = aws_subnet.private_b.id
  }
}`,
      },
      {
        title: 'Front-End VPCE (AWS CLI)',
        lang: 'bash',
        code:
`aws ec2 create-vpc-endpoint \\
  --vpc-id vpc-0123456789abcdef0 \\
  --service-name com.amazonaws.vpce.<region>.databricks-workspace \\
  --vpc-endpoint-type Interface \\
  --subnet-ids subnet-aaa subnet-bbb \\
  --security-group-ids sg-0123456789abcdef0`,
      },
      {
        title: 'Windows DNS — Conditional Forwarder (PowerShell)',
        lang: 'powershell',
        code:
`Add-DnsServerConditionalForwarderZone \`
  -Name "cloud.databricks.com" \`
  -MasterServers 10.0.1.10, 10.0.2.10 \`
  -ReplicationScope "Forest"

# 10.0.1.10, 10.0.2.10 = Route 53 Inbound Resolver ENI IPs`,
      },
      {
        title: 'BIND — Conditional Forwarder',
        lang: 'text',
        code:
`zone "cloud.databricks.com" {
    type forward;
    forward only;
    forwarders { 10.0.1.10; 10.0.2.10; };
};`,
      },
    ],

    diagram: {
      zones: [
        { id: 'onprem', label: 'On-Premises Network', x: 20, y: 50, w: 190, h: 300, style: 'comp-box-onprem' },
        { id: 'vpc', label: 'Customer VPC', x: 300, y: 50, w: 350, h: 300, style: 'comp-box-vpc' },
        { id: 'databricks', label: 'Databricks', x: 740, y: 50, w: 190, h: 300, style: 'comp-box-db' },
      ],
      nodes: [
        { id: 'client',   label: 'Client',              sub: 'Browser / CLI',                     x: 60,  y: 120, w: 110, h: 48, zone: 'onprem' },
        { id: 'corpdns',  label: 'Corporate DNS',        sub: '*.cloud.databricks.com →',          x: 60,  y: 270, w: 110, h: 48, zone: 'onprem' },
        { id: 'dxvpn',    label: 'DX / VPN',             sub: 'Private link',                      x: 230, y: 195, w: 80,  h: 44, zone: null },
        { id: 'resolver', label: 'R53 Inbound',          sub: 'Resolver Endpoint',                 x: 380, y: 270, w: 120, h: 48, zone: 'vpc' },
        { id: 'phz',      label: 'Route 53 PHZ',         sub: 'privatelink.cloud.databricks.com',  x: 370, y: 110, w: 150, h: 48, zone: 'vpc' },
        { id: 'vpce',     label: 'Front-End VPCE',       sub: 'ENI: 10.0.x.x',                    x: 555, y: 195, w: 120, h: 48, zone: 'vpc' },
        { id: 'cp',       label: 'Control Plane',        sub: 'my-wksp.cloud.databricks.com',    x: 765, y: 195, w: 160, h: 48, zone: 'databricks', style: 'comp-box-db' },
      ],
      connections: [
        { from: 'client',   to: 'corpdns',  type: 'dns-query',    step: 1, label: 'DNS query' },
        { from: 'corpdns',  to: 'dxvpn',    type: 'dns-query',    step: 2, label: 'Fwd *.cloud...' },
        { from: 'dxvpn',    to: 'resolver',  type: 'dns-query',    step: 3, label: '' },
        { from: 'resolver', to: 'phz',       type: 'dns-query',    step: 4, label: 'CNAME → PHZ', badgePos: 0.75 },
        { from: 'phz',      to: 'resolver',  type: 'dns-response', step: 5, label: 'Private IP' },
        { from: 'resolver', to: 'dxvpn',     type: 'dns-response', step: 6, label: '' },
        { from: 'dxvpn',    to: 'corpdns',   type: 'dns-response', step: 6, label: '' },
        { from: 'corpdns',  to: 'client',    type: 'dns-response', step: 6, label: '10.0.x.x' },
        { from: 'client',   to: 'dxvpn',     type: 'https',        step: 7, label: '' },
        { from: 'dxvpn',    to: 'vpce',      type: 'https',        step: 7, label: '' },
        { from: 'vpce',     to: 'cp',        type: 'https',        step: 7, label: 'PrivateLink' },
      ],
    },
  },

  /* ----------------------------------------------------------
     Scenario B — Workspace-Specific DNS Forward
     ---------------------------------------------------------- */
  workspace: {
    id: 'workspace',
    title: 'On-Prem: Workspace-Specific DNS Forwarding',
    overview:
      'Instead of forwarding all <code>*.cloud.databricks.com</code> queries, the on-prem DNS server has conditional forwarders ' +
      'targeting only the specific workspace FQDN (e.g., <code>my-wksp.cloud.databricks.com</code>), its data plane relay domain ' +
      '(<code>dbc-dp-&lt;workspace-id&gt;.cloud.databricks.com</code>), and any Databricks Apps domains (e.g., <code>my-app.aws.databricksapps.com</code>) tied to the workspace. ' +
      'This is more surgical — other Databricks workspaces still resolve via public DNS. ' +
      'The rest of the flow is identical to the wildcard scenario: Route 53 Inbound Resolver, PHZ (<code>privatelink.cloud.databricks.com</code>) with a region A record, VPCE, PrivateLink.',

    useCase:
      'Best when only a subset of Databricks workspaces need front-end PrivateLink. ' +
      'Non-targeted workspaces continue to resolve via public DNS, so there is no risk of breaking access to workspaces that are not configured for PrivateLink.',

    caveats: [
      'Each workspace requires <strong>multiple</strong> conditional forwarder entries: the workspace FQDN, its <code>dbc-dp-&lt;workspace-id&gt;.cloud.databricks.com</code> data plane relay domain, and the specific <code>&lt;app-name&gt;.aws.databricksapps.com</code> hostname for each Databricks App deployed to that workspace. Do <strong>not</strong> forward all of <code>*.databricksapps.com</code> — only forward the individual App hostnames associated with workspaces that require front-end PrivateLink.',
      'When a new workspace is provisioned and needs PrivateLink, DNS changes must be made on-prem for all associated domains before it can be reached privately. This is an operational step that can be missed.',
      'If the DNS team is separate from the cloud team, each new workspace requires a cross-team change request — and each new Databricks App deployed to that workspace may require another.',
      'The wildcard approach (Scenario A) avoids maintenance for <code>*.cloud.databricks.com</code> domains but still requires a per-app forwarder for each Databricks Apps hostname on <code>databricksapps.com</code>.',
    ],

    steps: [
      { id: 1, label: 'Client queries on-prem DNS',           detail: 'The client queries the corporate DNS server for <strong>my-wksp.cloud.databricks.com</strong>.' },
      { id: 2, label: 'Conditional forwarder matches workspace domain', detail: 'The corporate DNS server matches the query against conditional forwarding rules for this workspace\'s domains: <strong>my-wksp.cloud.databricks.com</strong>, <strong>dbc-dp-&lt;workspace-id&gt;.cloud.databricks.com</strong>, and the specific <strong>Databricks Apps</strong> hostnames (e.g., <code>my-app.aws.databricksapps.com</code>) tied to this workspace. Queries for other workspaces and their apps resolve via public DNS.' },
      { id: 3, label: 'Route 53 Inbound Resolver receives query', detail: 'The DNS query arrives at the <strong>Route 53 Inbound Resolver endpoint</strong> ENIs in the customer VPC via Direct Connect / VPN.' },
      { id: 4, label: 'Public CNAME redirects to privatelink domain', detail: 'Databricks public DNS returns a <strong>CNAME</strong> from <strong>my-wksp.cloud.databricks.com</strong> to <strong>&lt;region&gt;.privatelink.cloud.databricks.com</strong> (e.g., <code>nvirginia.privatelink.cloud.databricks.com</code>). This CNAME is what causes the query to match the Private Hosted Zone.' },
      { id: 5, label: 'Route 53 resolves via PHZ',             detail: 'Because the VPC has an associated PHZ for <strong>privatelink.cloud.databricks.com</strong>, Route 53 intercepts the CNAME target and resolves the <strong>A record</strong> for <strong>&lt;region&gt;.privatelink.cloud.databricks.com</strong>, returning the <strong>private IP</strong> of the front-end VPCE ENI.' },
      { id: 6, label: 'DNS response returns to client',        detail: 'The private IP address travels back: Inbound Resolver → DX/VPN → corporate DNS → client.' },
      { id: 7, label: 'HTTPS via VPCE to control plane',       detail: 'The client sends HTTPS traffic to the private IP. Traffic flows over DX/VPN to the <strong>front-end VPCE ENI</strong>, then through <strong>AWS PrivateLink</strong> to the Databricks control plane.' },
    ],

    components: [
      { name: 'Client Device',              purpose: 'Originates DNS query and HTTPS request from on-prem',        config: 'Uses corporate DNS server; routable to VPC via DX/VPN' },
      { name: 'Corporate DNS Server',        purpose: 'Forwards target workspace and associated domains to Route 53', config: 'Conditional forwarders: my-wksp.cloud.databricks.com, dbc-dp-&lt;workspace-id&gt;.cloud.databricks.com, and each Databricks Apps domain (e.g., my-app.aws.databricksapps.com) -> Inbound Resolver ENI IPs' },
      { name: 'Direct Connect / VPN',        purpose: 'Private network link between on-prem and AWS VPC',           config: 'Must allow DNS (UDP/TCP 53) and HTTPS (TCP 443)', link: 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html' },
      { name: 'Route 53 Inbound Resolver',   purpose: 'Receives forwarded DNS queries inside the VPC',              config: 'Same as wildcard scenario — no per-workspace config needed', link: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-getting-started.html' },
      { name: 'Route 53 Private Hosted Zone', purpose: 'Maps region hostname to VPCE private IP',                   config: 'Zone: privatelink.cloud.databricks.com; A record for &lt;region&gt;.privatelink.cloud.databricks.com (e.g., nvirginia, ohio, frankfurt, tokyo)', link: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html' },
      { name: 'Front-End VPCE',              purpose: 'Interface endpoint providing private access to Databricks',   config: 'Same VPCE as wildcard scenario — shared across workspaces', link: 'https://docs.databricks.com/en/security/network/classic/privatelink.html' },
      { name: 'Databricks Control Plane',    purpose: 'Hosts workspace UI and REST API',                            config: 'Accessible via PrivateLink; workspace-specific URL', link: 'https://docs.databricks.com/en/security/network/classic/privatelink.html' },
    ],

    configs: [
      {
        title: 'Windows DNS — Workspace-Specific Forwarders (PowerShell)',
        lang: 'powershell',
        code:
`# 1. Workspace URL
Add-DnsServerConditionalForwarderZone \`
  -Name "my-wksp.cloud.databricks.com" \`
  -MasterServers 10.0.1.10, 10.0.2.10 \`
  -ReplicationScope "Forest"

# 2. Data plane relay domain
Add-DnsServerConditionalForwarderZone \`
  -Name "dbc-dp-a1b2c3d4e5f6.cloud.databricks.com" \`
  -MasterServers 10.0.1.10, 10.0.2.10 \`
  -ReplicationScope "Forest"

# 3. Databricks Apps — forward ONLY apps tied to this workspace
#    Do NOT wildcard-forward *.databricksapps.com
Add-DnsServerConditionalForwarderZone \`
  -Name "my-app.aws.databricksapps.com" \`
  -MasterServers 10.0.1.10, 10.0.2.10 \`
  -ReplicationScope "Forest"

# Add one entry per app on this workspace.
# Apps on workspaces without front-end PL should resolve publicly.`,
      },
      {
        title: 'BIND — Workspace-Specific Forwarders',
        lang: 'text',
        code:
`# 1. Workspace URL
zone "my-wksp.cloud.databricks.com" {
    type forward;
    forward only;
    forwarders { 10.0.1.10; 10.0.2.10; };
};

# 2. Data plane relay domain
zone "dbc-dp-a1b2c3d4e5f6.cloud.databricks.com" {
    type forward;
    forward only;
    forwarders { 10.0.1.10; 10.0.2.10; };
};

# 3. Databricks Apps — forward ONLY apps tied to this workspace
#    Do NOT wildcard-forward *.databricksapps.com
zone "my-app.aws.databricksapps.com" {
    type forward;
    forward only;
    forwarders { 10.0.1.10; 10.0.2.10; };
};

# Add one zone block per app on this workspace.
# Apps on workspaces without front-end PL should resolve publicly.`,
      },
      {
        title: 'Route 53 PHZ Record (Terraform)',
        lang: 'hcl',
        code:
`resource "aws_route53_record" "my_workspace" {
  zone_id = aws_route53_zone.databricks_phz.zone_id
  name    = "my-wksp.cloud.databricks.com"
  type    = "CNAME"
  ttl     = 300
  records = [
    aws_vpc_endpoint.databricks_fe.dns_entry[0]["dns_name"]
  ]
}`,
      },
    ],

    diagram: {
      zones: [
        { id: 'onprem', label: 'On-Premises Network', x: 20, y: 50, w: 190, h: 300, style: 'comp-box-onprem' },
        { id: 'vpc', label: 'Customer VPC', x: 300, y: 50, w: 350, h: 300, style: 'comp-box-vpc' },
        { id: 'databricks', label: 'Databricks', x: 740, y: 50, w: 190, h: 300, style: 'comp-box-db' },
      ],
      nodes: [
        { id: 'client',   label: 'Client',              sub: 'Browser / CLI',                          x: 60,  y: 120, w: 110, h: 48, zone: 'onprem' },
        { id: 'corpdns',  label: 'Corporate DNS',        sub: 'wksp + dp + apps →',                 x: 60,  y: 270, w: 110, h: 48, zone: 'onprem' },
        { id: 'dxvpn',    label: 'DX / VPN',             sub: 'Private link',                           x: 230, y: 195, w: 80,  h: 44, zone: null },
        { id: 'resolver', label: 'R53 Inbound',          sub: 'Resolver Endpoint',                      x: 380, y: 270, w: 120, h: 48, zone: 'vpc' },
        { id: 'phz',      label: 'Route 53 PHZ',         sub: 'privatelink.cloud.databricks.com',       x: 370, y: 110, w: 150, h: 48, zone: 'vpc' },
        { id: 'vpce',     label: 'Front-End VPCE',       sub: 'ENI: 10.0.x.x',                         x: 555, y: 195, w: 120, h: 48, zone: 'vpc' },
        { id: 'cp',       label: 'Control Plane',        sub: 'my-wksp.cloud.databricks.com',      x: 765, y: 195, w: 160, h: 48, zone: 'databricks', style: 'comp-box-db' },
      ],
      connections: [
        { from: 'client',   to: 'corpdns',  type: 'dns-query',    step: 1, label: 'DNS query' },
        { from: 'corpdns',  to: 'dxvpn',    type: 'dns-query',    step: 2, label: 'Fwd workspace' },
        { from: 'dxvpn',    to: 'resolver',  type: 'dns-query',    step: 3, label: '' },
        { from: 'resolver', to: 'phz',       type: 'dns-query',    step: 4, label: 'CNAME → PHZ', badgePos: 0.75 },
        { from: 'phz',      to: 'resolver',  type: 'dns-response', step: 5, label: 'Private IP' },
        { from: 'resolver', to: 'dxvpn',     type: 'dns-response', step: 6, label: '' },
        { from: 'dxvpn',    to: 'corpdns',   type: 'dns-response', step: 6, label: '' },
        { from: 'corpdns',  to: 'client',    type: 'dns-response', step: 6, label: '10.0.x.x' },
        { from: 'client',   to: 'dxvpn',     type: 'https',        step: 7, label: '' },
        { from: 'dxvpn',    to: 'vpce',      type: 'https',        step: 7, label: '' },
        { from: 'vpce',     to: 'cp',        type: 'https',        step: 7, label: 'PrivateLink' },
      ],
    },
  },
};
