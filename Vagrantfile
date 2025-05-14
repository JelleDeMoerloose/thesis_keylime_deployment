Vagrant.configure("2") do |config|
  BOX_NAME = "ubuntu/jammy64"

  
  # Tenant
  config.vm.define "keylime_tenant" do |ten|
    ten.vm.box = BOX_NAME
    ten.vm.hostname = "tenant"
    ten.vm.network :private_network, ip: "192.168.33.13", auto_config: true
    ten.vm.provider :virtualbox do |vb|
      vb.memory = 2048
      vb.cpus   = 2
    end
    ten.vm.provision "shell", inline: <<-SHELL
      nmcli connection add type ethernet ifname enp0s8 con-name priv0 ip4 192.168.33.13/24
      nmcli connection up priv0 
       mkdir ~/.ssh/keylime
      cp /vagrant/.vagrant/machines/keylime_tenant/virtualbox/private_key ~/.ssh/keylime/keylime_tenant_key
      chmod 600 ~/.ssh/keylime/keylime_tenant_key
      # Update package list
      apt update

      # Install Ansible
      apt install -y ansible

    SHELL
  end
end
