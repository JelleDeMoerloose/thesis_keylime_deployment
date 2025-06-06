# thesis\_keylime\_deployment

This repository contains tools and scripts developed to facilitate experimentation with remote attestation using [Keylime](https://keylime.dev/). These experiments were conducted as part of a one-semester Research and Development Project (4 UNITS) titled: **"Enhancing Public Cloud Attestation with the SVSM-vTPM and Keylime"**.

## Overview

The project focuses on automating the deployment and setup of Keylime in various environments, including local virtual machines and Azure cloud infrastructure. It leverages tools like Vagrant, Ansible, and Pulumi to streamline the provisioning and configuration processes. To understand the internals of these tools, it is recommended to read my thesis and look inside the files. This documentation mainly shows how to use the tools . 

---

## Local Testing with Vagrant

### Prerequisites

Ensure the following are installed on your local machine:

* [Vagrant](https://www.vagrantup.com/downloads)
* [VirtualBox](https://www.virtualbox.org/wiki/Downloads) 
* [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) 

### Setup Instructions

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/JelleDeMoerloose/thesis_keylime_deployment.git
   cd thesis_keylime_deployment
   ```

2. **Start the Multi-VM infrastructure**

    each Keylime component will get its own VM 

   ```bash
   vagrant up
   ```

   This command will provision a virtual machine using the provided `Vagrantfile`. Other usefull commands:
   
   `vagrant destroy` to destroy the infrastructure.
    
    `vagrant suspend` to save the state and shut down the VMs

   `vagrant resume`to continue the saved VM's


3. **Access the VMs**

   ```bash
   vagrant ssh keylime_<componentname>
   ```

   This will SSH into the VM, allowing you to interact with the environment directly.

    *Usefull tip:* If you ever need to copy files from one VM to another in this setup, you can use the shared Vagrant folder `/vagrant/` as root user (no need for `ssh`) 



5. **Run Ansible Playbook:**
   Because I was using Windows, I could not use Ansible. So I ssh-ed into the tenant using `vagrant ssh keylime_tenant` and cloned this github repository. Ansible is already installed on this machine, and the hostfile will work without any changes.

   To automatically provision the VM setup with Keylime and configure it correctly, you can use the Ansible `playbook.yml` file. Make sure that you turn `swtpm_enabled: true` (inside `group_vars/all`) to install a TPM emulator and IMA emulator, as these local VM's do not have a dedicated TPM. 

   Execute this on the tenant.

   ```bash
   ansible-playbook -i hosts_vagrant.ini playbook.yml
   ```

   *Note:* If your executing Ansible on your host machine, change the location of the ssh-keys in the `hosts_vagrant.ini`file accordingly

### Testing Remote Attestation

Once the environment is set up, you can test remote attestation with Keylime using a simple runtime policyand an "evil" script:

1. **Create a Baseline Policy on the Agent VM**

    On the node that needs to be attested (the agent VM), run the following command to scan the system, create a runtime policy, and exclude dynamic paths using the provided `excludes_list.txt` (can be modified to your own liking):

    ```bash
    git clone https://github.com/keylime/keylime.git

    /root/keylime/scripts/create_runtime_policy.sh  -o test_runtime_policy.json -a sha256sum -e excludes_list.txt
    ```

    * `-e excludes_list.txt` provides a list of files and directories to ignore during the scan. For these files you don't care about integrity. It is highly recommended to add such an excludeslist, otherwise the Keylime verifier will pick up on every insignificant change and will trigger revocation. This repo contains an example file.

    The generated `test_runtime_policy.json` will contain the baseline hashes of all included files. Move this file to the tenant, using the `/vagrant` shared folder. The tenant will later use this to deploy this policy on the agent. 

2. **Run the component**

    Ssh into every component and on start the respective service on each component in this order:

    ````
    keylime_registrar #on registrar
    keylime_verifier #on verifier
    RUST_LOG=debug keylime_agent #on agent
    ````

3. **Deploy the Runtime Policy**

    After creating the policy, deploy it using the following command on the tenant:

    ```bash
    keylime_tenant -v 192.168.33.12 -t 192.168.33.10 -u d432fbb3-d2f1-4a97-9ef7-75bd81c00000 --runtime-policy test_runtime_policy.json
    ````
    `-v` is the verifier IP

    `-t` is the agent (target of the policy) IP

    `-u` is the UUID of the agent


    --> this will succesfully start remote attestation (you will see it in the consoles)

3. **Simulate a Breach with a Test Script**

    Create a simple script named `evil.sh` on a seperate terminal of the agent with the following content:

    ```bash
    #!/bin/bash
    echo "This is a test attack."
    ```

    Make it executable and run it:

    ```bash
    chmod +x evil.sh
    ./evil.sh
    ```

    Since this script was not excluded by the runtime policy, its presence and execution will be detected by Keylime, triggering a revocation by the verifier and confirming that remote attestation is working properly. (seen in the terminal)

---

## Azure Infrastructure as Code (IaC) Deployment

### Prerequisites

Ensure the following tools are installed and configured:

* [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
* [Pulumi](https://www.pulumi.com/docs/get-started/install/)
* [Node.js and npm](https://nodejs.org/en/download/)
* [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

You also need access to the `Standard_DC2as_v5` VM size , as this is a confidential machine with Azure's VTPM. Access can be requested using the Azure Portal. You can also use the trustedlaunch VM's containing a similar (but way less secure ) vTPM to test the infrastructure, this requires editing of the `/IaC/index.ts`file. This file also uses the resource group `Jelle-Thesis-Resources`, which can be changed in `Pulumi.dev.yaml` to your own resource group. 

### Setup Instructions

1. **Authenticate with Azure:**

   ```bash
   az login
   ```

   This command will open a browser window for you to log in to your Azure account.

2. **Install Pulumi Dependencies:**

   After cloning this repo, navigate to the Azure IaC directory and install the necessary npm packages:

   ```bash
   cd IaC
   npm install
   ```

3. **Deploy Infrastructure with Pulumi:**

   Initialize and Pulumi project:

   ```bash
   pulumi login --local
   pulumi stack init dev  # creates the stack and generates encryption salt
   ```

   Now you copy the values from `Pulumi.template.yaml` to `Pulumi.dev.yaml` , while keeping your encryption salt. 
   Now you can create the defined Azure infrastructure in `index.ts`:
   ````bash
   pulumi up
   ````

   This last command will provision the defined Azure resources.

   You can use `pulumi destroy` to safely destroy all resources created on Azure, making sure you are not incurring any costs. 

4. **Run Ansible Playbook on Azure VM:**

   After the infrastructure is set up, we copy the newly created ssh-key into the tenant using `scp`, as the tenant will be used again as our ansible control node. Install Ansible on the tenant , and clone this repo. 

   Modify the `hosts_pulumi.ini` file so that the `ansible_host` of each Keylime component match the private IP of the corresponding VM . Additionally, change the path to the ssh-key, to where you stored it. Lastly, make sure that in `/group_vars/all.yml` the software tpm is disabled, as we are using Azure's vTPM. (the tpm emulator is not supported on ubuntu anyways)

   Automatically provision and configure the VM's: (I used the tenant again to run this command, after cloning )
   ```bash
   ansible-playbook -i hosts_pulumi.ini playbook.yml
   ```
   Run an extra playbook, to configure keylime specially for this Azure setup:
    ```bash
   ansible-playbook -i hosts_pulumi.ini playbook_azure.yml
   ```

    Now you can use the same workflow described in [Testing Remote Attestation](#testing-remote-attestation) of the local setup. To start using Keylime. For making your own workflow i recommend looking through [Keylime's Documentation](https://keylime.readthedocs.io/en/latest/)


---

## Customization options

This project is build so that you can customize these environments and the Keylime setup easily, to perform multiple tests on the framework.

### Infrastructure customization

For local testing, you can change the `Vragrantfile` as you like. This allows you to increase or decrease the amount of VM's, use other network configurations ,... . 

For testing on Azure, you can change the variables in `Pulumi.dev.yaml` and/or change the index.ts file to your liking.

**Important to note**: change the `hosts_<X>.ini` file accordingly, and if you are planning to run multiple Keylime components on 1 VM use the following playbook instead `playbook_serial` (makes sure package installer is not blocked).

### Ansible Keylime Configuration

You can change the configuration variables used in the playbook in `group_vars/all.yml` and in `/host_vars` for each component individually. This allows you to set up custom Keylime workflows. To check out additional configuration options on the VMs provisioned with Keylime, in `/etc/keylime/`  you will find configuration files that document the options for each component. You can set them using ENV variables (see [Keylime's Documentation](https://keylime.readthedocs.io/en/latest/)).

### Certificate customization

For experimenting, we use some sample certificates out of `/CA` to set up mTLS. You can use your own certificates instead, but you just have to specify the paths in the ansible configuration files specified above. To know how to destribute the certificates, checking how its done now in the Ansible and reading my thesis Section 4.3.4 .

