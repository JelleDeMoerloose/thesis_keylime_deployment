Vagrant.configure("2") do |config|
  BOX_NAME = "fedora/41-cloud-base"

  # Agent
  config.vm.define "keylime_agent" do |agent|
    agent.vm.box = BOX_NAME
    agent.vm.hostname = "agent"
    agent.vm.network :private_network, ip: "192.168.33.10", auto_config: true
    agent.vm.provider :virtualbox do |vb|
      vb.memory = 2048
      vb.cpus   = 2
    end
    agent.vm.provision "shell", inline: <<-SHELL
      nmcli connection add type ethernet ifname enp0s8 con-name priv0 ip4 192.168.33.10/24
      nmcli connection up priv0 connection.autoconnect yes
    SHELL
  end

  # Registrar
  config.vm.define "keylime_registrar" do |reg|
    reg.vm.box = BOX_NAME
    reg.vm.hostname = "registrar"
    reg.vm.network :private_network, ip: "192.168.33.11", auto_config: true
    reg.vm.provider :virtualbox do |vb|
      vb.memory = 2048
      vb.cpus   = 2
    end
    reg.vm.provision "shell", inline: <<-SHELL
      nmcli connection add type ethernet ifname enp0s8 con-name priv0 ip4 192.168.33.11/24
      nmcli connection up priv0 connection.autoconnect yes
    SHELL
  end

  # Verifier
  config.vm.define "keylime_verifier" do |ver|
    ver.vm.box = BOX_NAME
    ver.vm.hostname = "verifier"
    ver.vm.network :private_network, ip: "192.168.33.12", auto_config: true
    ver.vm.provider :virtualbox do |vb|
      vb.memory = 2048
      vb.cpus   = 2
    end
    ver.vm.provision "shell", inline: <<-SHELL
      nmcli connection add type ethernet ifname enp0s8 con-name priv0 ip4 192.168.33.12/24
      nmcli connection up priv0 connection.autoconnect yes
    SHELL
  end

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
      nmcli connection up priv0 connection.autoconnect yes
      #copy ssh keys from vagrant --> way easier to run ansible scripts --> cant run ansible on windows
      cp /vagrant/.vagrant/machines/keylime_agent/virtualbox/private_key ~/.ssh/keylime/keylime_agent_key
      chmod 600 ~/.ssh/keylime/keylime_agent_key
      cp /vagrant/.vagrant/machines/keylime_registrar/virtualbox/private_key ~/.ssh/keylime/keylime_registrar_key
      chmod 600 ~/.ssh/keylime/keylime_registrar_key
      cp /vagrant/.vagrant/machines/keylime_verifier/virtualbox/private_key ~/.ssh/keylime/keylime_verifier_key
      chmod 600 ~/.ssh/keylime/keylime_verifier_key
      cp /vagrant/.vagrant/machines/keylime_tenant/virtualbox/private_key ~/.ssh/keylime/keylime_tenant_key
      chmod 600 ~/.ssh/keylime/keylime_tenant_key
    SHELL
  end
end
