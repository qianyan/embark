import { sha3 } from 'embark-utils';

class DeployTracker {

  constructor(embark, options) {
    this.logger = embark.logger;
    this.events = embark.events;
    this.embark = embark;
    this.fs = embark.fs;
    this.trackContracts = (options.trackContracts !== false);

    // TODO: unclear where it comes from
    this.env = options.env;
    this.chainConfig = {};
    this.chainFile = embark.config.contractsConfig.tracking;
    this.loadChainTrackerFile();
    this.registerEvents();
  }

  loadChainTrackerFile() {
    if (this.chainFile === false) return;
    if (this.chainFile === undefined) this.chainFile = ".embark/chains.json";
    this.chainFile = this.fs.dappPath(this.chainFile);
    if (!this.fs.existsSync(this.chainFile)) {
      this.logger.info(this.chainFile + ' ' + __('file not found, creating it...'));
      this.fs.outputJSONSync(this.chainFile, {});
    }

    this.chainConfig = this.fs.readJSONSync(this.chainFile);
  }

  registerEvents() {
    if (this.chainFile === false) return;
    const self = this;

    this.embark.registerActionForEvent("deploy:beforeAll", this.setCurrentChain.bind(this));

    this.events.on("deploy:contract:deployed", (contract) => {
      self.trackContract(contract.className, contract.realRuntimeBytecode, contract.realArgs, contract.deployedAddress);
      self.save();
    });

    self.embark.registerActionForEvent("deploy:contract:shouldDeploy", (params, cb) => {
      if (!self.trackContracts) {
        return cb(null, params);
      }

      let contract = params.contract;
      let trackedContract = self.getContract(contract.className, contract.realRuntimeBytecode, contract.realArgs);
      if (trackedContract) {
        params.contract.address = trackedContract.address;
      }
      if (params.shouldDeploy && trackedContract) {
         params.shouldDeploy = true;
      }
      cb(null, params);
    });
  }

  setCurrentChain(cb) {
    const self = this;
    if (this.chainConfig === false) {
      this.currentChain = {contracts: []};
      return cb();
    }
    this.events.request("blockchain:block:byNumber", 0, function(err, block) {
      if (err) {
        return cb(err);
      }
      let chainId = block.hash;

      if (self.chainConfig[chainId] === undefined) {
        self.chainConfig[chainId] = {contracts: {}};
      }

      self.currentChain = self.chainConfig[chainId];

      self.currentChain.name = self.env;
      cb();
    });
  }

  loadConfig(config) {
    this.chainConfig = config;
    return this;
  }

  trackContract(contractName, code, args, address) {
    if (!this.currentChain) return false;
    this.currentChain.contracts[sha3(code + contractName + args.join(','))] = {
      name: contractName,
      address: address
    };
  }

  getContract(contractName, code, args) {
    if (!this.currentChain) return false;
    let contract = this.currentChain.contracts[sha3(code + contractName + args.join(','))];
    if (contract && contract.address === undefined) {
      return false;
    }
    return contract;
  }

  // TODO: abstract this
  // chainConfig can be an abstract PersistentObject
  save() {
    if (this.chainConfig === false) {
      return;
    }
    this.fs.writeJSONSync(this.chainFile, this.chainConfig, {spaces: 2});
  }

}

module.exports = DeployTracker;
