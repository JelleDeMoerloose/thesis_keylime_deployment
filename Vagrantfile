Vagrant.configure("2") do |config|
  

  # Base box for all machines
  BOX_NAME = "fedora/41-cloud-base"

  # Agent
  config.vm.define "keylime_agent" do |agent|
    agent.vm.box = BOX_NAME
    agent.vm.hostname = "agent"
    agent.vm.network :private_network, ip: "192.168.33.10"
    agent.vm.provider :virtualbox do |vb|
      vb.memory = 1024
      vb.cpus   = 1
    end
    agent.vm.provider :libvirt do |lv|
      lv.memory = 2048
      lv.cpus   = 1
    end
  end

  # Registrar
  config.vm.define "keylime_registrar" do |reg|
    reg.vm.box = BOX_NAME
    reg.vm.hostname = "registrar"
    reg.vm.network :private_network, ip: "192.168.33.11"
    reg.vm.provider :virtualbox do |vb|
      vb.memory = 1024
      vb.cpus   = 1
    end
    reg.vm.provider :libvirt do |lv|
      lv.memory = 1024
      lv.cpus   = 1
    end
  end

  # Verifier
  config.vm.define "keylime_verifier" do |ver|
    ver.vm.box = BOX_NAME
    ver.vm.hostname = "verifier"
    ver.vm.network :private_network, ip: "192.168.33.12"
    ver.vm.provider :virtualbox do |vb|
      vb.memory = 1024
      vb.cpus   = 1
    end
    ver.vm.provider :libvirt do |lv|
      lv.memory = 1024
      lv.cpus   = 1
    end
  end

  # Tenant
  config.vm.define "keylime_tenant" do |ten|
    ten.vm.box = BOX_NAME
    ten.vm.hostname = "tenant"
    ten.vm.network :private_network, ip: "192.168.33.13"
    ten.vm.provider :virtualbox do |vb|
      vb.memory = 1024
      vb.cpus   = 1
    end
    ten.vm.provider :libvirt do |lv|
      lv.memory = 1024
      lv.cpus   = 1
    end
  end

  # Optional: synced folder (if you have shared code/config)
  # config.vm.synced_folder "./host_keylime", "/home/vagrant/keylime", type: "rsync"

  # Provisioning hooks could go here to install Keylime components
  # e.g. config.vm.provision "shell", inline: "dnf install -y keylime*"
end