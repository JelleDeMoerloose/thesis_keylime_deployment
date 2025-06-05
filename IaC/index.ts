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
const vmSize = config.get("vmSize") || "Standard_A1_v2";
const osImage = config.get("osImage") || "Debian:debian-11:11:latest";
const adminUsername = config.get("adminUsername") || "pulumiuser";
const existingRgName = config.get("RgName") || "";
const IMA_policy_name = config.get("ima_policy_file") || "./simple_ima_policy"
const vmRoles = config.requireObject<string[]>("vmRoles");

const [osImagePublisher, osImageOffer, osImageSku, osImageVersion] = osImage.split(":");

// Create an SSH key
const sshKey = new tls.PrivateKey("ssh-key", {
    algorithm: "RSA",
    rsaBits: 4096,
});



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

// Create a security group allowing inbound access over port 22 (for SSH)
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
        }
    ],
});


// first vm is a confidential Virtual machine 
for (const name of vmRoles) {
    const isConfidential = name.endsWith("CVM");

    // Public IP + DNS label
    const pip = new network.PublicIPAddress(`${name}-pip`, {
        resourceGroupName: existingRgName,
        publicIPAllocationMethod: isConfidential
            ? network.IPAllocationMethod.Static
            : network.IPAllocationMethod.Dynamic,
        zones: isConfidential ? ["2"] : undefined, // Ensure zone matches the VM
        sku: isConfidential ? { name: "Standard" } : undefined,
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

    // Init script
    let customData: string | undefined;
    if (isConfidential) {
        const filePolicyContent = fs.readFileSync(IMA_policy_name, "utf8").replace(/\r\n/g, "\n");;
        const initScript = `#!/bin/bash
cat <<EOF > /home/${adminUsername}/file_policy
${filePolicyContent}
EOF

# Apply the policy
sudo cat /home/${adminUsername}/file_policy > /sys/kernel/security/ima/policy
`;
        customData = Buffer.from(initScript).toString("base64");
    }

    const vm = new compute.VirtualMachine(name, {
        resourceGroupName: existingRgName,
        zones: isConfidential ? ["2"] : undefined, // Specifies Availability Zone 2 --> confidential computing only in zone 2 and 3, not in 1
        networkProfile: { networkInterfaces: [{ id: nic.id, primary: true }] },
        hardwareProfile: { vmSize: isConfidential ? "Standard_DC2as_v5" : vmSize },
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
            osDisk: isConfidential ? {
                name: `${name}-osdisk`,
                createOption: compute.DiskCreateOption.FromImage,
                deleteOption: "Delete",
                managedDisk: {
                    storageAccountType: "Standard_LRS",
                    securityProfile: {
                        securityEncryptionType: "DiskWithVMGuestState", // otherwise i got errors
                    },
                },
            } : {
                name: `${name}-osdisk`,
                createOption: compute.DiskCreateOption.FromImage,
                deleteOption: "Delete",
                managedDisk: {
                    storageAccountType: "Standard_LRS",
                },
            },
            imageReference: isConfidential ? {
                publisher: "Canonical",
                offer: "0001-com-ubuntu-confidential-vm-jammy",
                sku: "22_04-lts-cvm",
                version: "latest",
            } : {
                publisher: osImagePublisher,
                offer: osImageOffer,
                sku: osImageSku,
                version: osImageVersion,
            },
        },
        securityProfile: {
            securityType: isConfidential ? "ConfidentialVM" : "TrustedLaunch",
            uefiSettings: {
                secureBootEnabled: true,
                vTpmEnabled: true,
            },
        },
    });

}



sshKey.privateKeyOpenssh.apply(privateKey => {
    if (!pulumi.runtime.isDryRun()) {
        const keyPath = path.join(process.cwd(), "ssh-key");
        fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
        console.log(`Private SSH key written to ${keyPath}`);
    } else {
        console.log("Preview: SSH key write skipped");
    }
});




export const privatekey = sshKey.privateKeyOpenssh;
