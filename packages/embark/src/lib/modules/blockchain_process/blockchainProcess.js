import * as i18n from 'embark-i18n';
const ProcessWrapper = require('../../core/processes/processWrapper');
const BlockchainClient = require('./blockchain');
const constants = require('embark-core/constants');

let blockchainProcess;

class BlockchainProcess extends ProcessWrapper {
  constructor(options) {
    super();
    this.blockchainConfig = options.blockchainConfig;
    this.client = options.client;
    this.env = options.env;
    this.isDev = options.isDev;
    this.certOptions = options.certOptions;

    i18n.setOrDetectLocale(options.locale);

    this.blockchainConfig.silent = true;
    this.blockchain = BlockchainClient(
      this.blockchainConfig,
      this.client,
      this.env,
      this.certOptions,
      this.blockchainReady.bind(this),
      this.blockchainExit.bind(this),
      console
    );

    this.blockchain.run();
  }

  blockchainReady() {
    blockchainProcess.send({result: constants.blockchain.blockchainReady});
  }

  blockchainExit() {
    // tell our parent process that ethereum client has exited
    blockchainProcess.send({result: constants.blockchain.blockchainExit});
  }

  kill() {
    this.blockchain.kill();
  }
}

process.on('message', (msg) => {
  if (msg === 'exit') {
    return blockchainProcess.kill();
  }
  if (msg.action === constants.blockchain.init) {
    blockchainProcess = new BlockchainProcess(msg.options);
    return blockchainProcess.send({result: constants.blockchain.initiated});
  }
});
