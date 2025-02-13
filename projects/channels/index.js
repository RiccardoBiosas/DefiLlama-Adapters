const _ = require('underscore');
const sdk = require('@defillama/sdk');
const abi = require('./abi.json');

const comptroller = "0x8955aeC67f06875Ee98d69e6fe5BDEA7B60e9770"

// ask comptroller for all markets array
async function getAllCTokens(block) {
    return (await sdk.api.abi.call({
        block,
        chain: "heco",
        target: comptroller,
        params: [],
        abi: abi['getAllMarkets'],
    })).output;
}

async function getUnderlying(block, cToken) {
    if (cToken === '0x397c6D1723360CC1c317CdC9B2E926Ae29626Ff3') {
        return '0x6f259637dcd74c767781e37bc6133cd6a68aa161';//cHT => HT
    } else {
        const token = (await sdk.api.abi.call({
            block,
            chain: 'heco',
            target: cToken,
            abi: abi['underlying'],
        })).output;
        if (token === '0x3D760a45D0887DFD89A2F5385a236B29Cb46ED2a') {
            return '0x6b175474e89094c44da98b954eedeac495271d0f';//DAI => DAI
        } else if (token === '0x9362Bbef4B8313A8Aa9f0c9808B80577Aa26B73B') {
            return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';//USDC => USDC
        } else {
            return 'heco:' + token
        }
    }
}

// returns {[underlying]: [cToken]}
async function getMarkets(block) {
    let allCTokens = await getAllCTokens(block);
    const markets = []
    await (
        Promise.all(allCTokens.map(async (cToken) => {
            let underlying = await getUnderlying(block, cToken);
            markets.push({underlying, cToken})
        }))
    );
    return markets;
}

async function tvl() {

    let balances = {};
    let timestamp = Math.round(new Date() / 1000)
    let currentBlock = (await sdk.api.util.lookupBlock(timestamp, {chain: "heco"}))
    let markets = await getMarkets();
    let LockedInfo = await sdk.api.abi.multiCall({
        currentBlock,
        calls: _.map(markets, (market) => ({
            target: market.cToken,
        })),
        chain: 'heco',
        abi: abi['getCash'],
    });

    _.each(markets, (market) => {
        let getCash = _.find(LockedInfo.output, (result) => result.input.target === market.cToken);
        if (getCash) {
            if (getCash.output === null) {
                throw new Error("failed")
            }
            sdk.util.sumSingleBalance(balances, market.underlying, getCash.output)
        }
    });
    return balances;
}

module.exports = {
    tvl,
};