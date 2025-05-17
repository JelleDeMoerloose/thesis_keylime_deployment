import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import * as compute from "@pulumi/azure-native/compute";
import * as random from "@pulumi/random";
import * as tls from "@pulumi/tls";
import * as fs from "fs";
import * as path from "path";

// Import the program's configuration settings
const config = new pulumi.Config();
const vmName = config.get("vmName") || "my-server";
const vmSize = config.get("vmSize") || "Standard_A1_v2";
const osImage = config.get("osImage") || "Debian:debian-11:11:latest";
const adminUsername = config.get("adminUsername") || "pulumiuser";
const servicePort = config.get("servicePort") || "80";
const existingRgName = config.get("RgName") || "";
const count = config.getNumber("vmCount") || 4;


const [osImagePublisher, osImageOffer, osImageSku, osImageVersion] = osImage.split(":");

// Create an SSH key
const sshKey = new tls.PrivateKey("ssh-key", {
    algorithm: "RSA",
    rsaBits: 4096,
});



// Create a resource group
//const resourceGroup = new resources.ResourceGroup("resource-group");
// Lookup the existing resource group --> later ifstatement
/*const resourceGroup = resources.getResourceGroupOutput({
    resourceGroupName: existingRgName,
});*/

// Create a virtual network
const virtualNetwork = new network.VirtualNetwork("network", {
    resourceGroupName: existingRgName,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
    subnets: [
        {
            name: `subnet`,
            addressPrefix: "10.0.1.0/24",
        },
    ],
});

// Create a security group allowing inbound access over ports 80 (for HTTP) and 22 (for SSH)
const securityGroup = new network.NetworkSecurityGroup("security-group", {
    resourceGroupName: existingRgName,
    securityRules: [
        {
            name: "SSH",
            priority: 100,
            direction: network.AccessRuleDirection.Inbound,
            access: "Allow",
            protocol: "Tcp",
            sourcePortRange: "*",
            sourceAddressPrefix: "*",
            destinationPortRange: "22",
            destinationAddressPrefix: "*",
        },
        {
            name: "HTTP",
            priority: 200,
            direction: network.AccessRuleDirection.Inbound,
            access: "Allow",
            protocol: "Tcp",
            sourcePortRange: "*",
            sourceAddressPrefix: "*",
            destinationPortRange: servicePort,
            destinationAddressPrefix: "*",
        },
    ],
});

// Helper to create one VM + nic + pip
interface VMInfo { name: string; ip: pulumi.Output<string | undefined>; }
const vms: VMInfo[] = [];

for (let i = 0; i < count; i++) {
    const name = `vm-${i}`;

    // Public IP + DNS label
    const pip = new network.PublicIPAddress(`${name}-pip`, {
        resourceGroupName: existingRgName,
        publicIPAllocationMethod: network.IPAllocationMethod.Dynamic,
        dnsSettings: {
            domainNameLabel: new random.RandomString(`${name}-dns`, {
                length: 8, upper: false, special: false,
            }).result.apply(r => `${name}-${r}`),
        },
    });

    // NIC
    const nic = new network.NetworkInterface(`${name}-nic`, {
        resourceGroupName: existingRgName,
        networkSecurityGroup: { id: securityGroup.id },
        ipConfigurations: [{
            name: "ipconfig",
            subnet: { id: virtualNetwork.subnets.apply(s => s![0].id!) },
            privateIPAllocationMethod: network.IPAllocationMethod.Dynamic,
            publicIPAddress: { id: pip.id },
        }],
    });

    // Only install HTTP on the first two
    let customData: string | undefined;
    if (i < 2) {
        const initScript = `#!/bin/bash
echo '<html><body><h1>Hello from ${name}</h1></body></html>' > index.html
nohup python3 -m http.server ${servicePort} &`;
        customData = Buffer.from(initScript).toString("base64");
    }

    // VM
    const vm = new compute.VirtualMachine(name, {
        resourceGroupName: existingRgName,
        networkProfile: { networkInterfaces: [{ id: nic.id, primary: true }] },
        hardwareProfile: { vmSize },
        osProfile: {
            computerName: name,
            adminUsername,
            customData,
            linuxConfiguration: {
                disablePasswordAuthentication: true,
                ssh: {
                    publicKeys: [{
                        keyData: sshKey.publicKeyOpenssh,
                        path: `/home/${adminUsername}/.ssh/authorized_keys`,
                    }],
                },
            },
        },
        storageProfile: {
            osDisk: {
                name: `${name}-osdisk`,
                createOption: compute.DiskCreateOption.FromImage,
                deleteOption: "Delete",
            },
            imageReference: {
                publisher: osImagePublisher,
                offer: osImageOffer,
                sku: osImageSku,
                version: osImageVersion,
            },
        },
        securityProfile: {
            securityType: "TrustedLaunch",
            uefiSettings: {
                secureBootEnabled: true,
                vTpmEnabled: true,
            },
        },

    });

    // Fetch its public IP
    const ip = pip.ipAddress || "";
    vms.push(
        { name, ip }
    );
}

// 2) Wait for all VM IPs, then build + write hosts.ini:
const names = vms.map(v => v.name);
const ipOuts = vms.map(v => v.ip);

pulumi.all(ipOuts).apply(ips => {
    // Now `ips` is a string[] with real IPs, in same order as `names`.

    // Build the [keylime] group
    const keylimeLines: string[] = [];
    for (let idx = 0; idx < names.length; idx++) {
        keylimeLines.push(`${names[idx]} ansible_host=${ips[idx]}`);
    }

    // Stitch together the final INI
    const ini = `
[all:vars]
ansible_user=${adminUsername}
ansible_ssh_private_key_file=./ssh-key

[keylime]
${keylimeLines.join("\n")}

[all]
${names.join(" ")}
  `.trim();

    // Only write on real `pulumi up`
    if (!pulumi.runtime.isDryRun()) {
        const iniPath = path.join(process.cwd(), "hosts.ini");
        fs.writeFileSync(iniPath, ini);
        console.log(`✔ hosts.ini written to ${iniPath}`);
    } else {
        console.log("⏭ Preview: hosts.ini write skipped");
    }

    return ini;
});
sshKey.privateKeyOpenssh.apply(privateKey => {
    if (!pulumi.runtime.isDryRun()) {
        const keyPath = path.join(process.cwd(), "ssh-key");
        fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
        console.log(`✔ Private SSH key written to ${keyPath}`);
    } else {
        console.log("⏭ Preview: SSH key write skipped");
    }
});




export const privatekey = sshKey.privateKeyOpenssh;
