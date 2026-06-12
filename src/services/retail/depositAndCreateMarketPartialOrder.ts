import { ethers } from "ethers";
import DarkSwapPartialAssetManagerAbi from "../../abis/DarkSwapPartialAssetManager.json";
import ERC20Abi from "../../abis/IERC20.json";
import ERC20_USDT from "../../abis/IERC20_USDT.json";
import { getConfirmations, legacyTokenConfig } from "../../config";
import { DarkSwap } from "../../darkSwap";
import { DarkSwapError } from "../../entities";
import { generateKeyPair } from "../../proof/keyService";
import { createOrderNoteExt, createPartialNote } from "../../proof/noteService";
import {
    generateRetailDepositCreateMarketPartialOrderProof,
    generateRetailMarketPartialOrderMessage,
    RetailDepositCreateMarketPartialOrderProofResult,
} from "../../proof/retail/depositCreateMarketPartialOrderProof";
import { DarkSwapBobMarketPartialOrderMessage, DarkSwapOrderNote, DarkSwapPartialNote, DEFAULT_VERSION, NoteCryptoContext } from "../../types";
import { MAX_ALLOWANCE } from "../../utils/constants";
import { bn_to_0xhex } from "../../utils/formatters";
import { hexlify32, isNativeAsset } from "../../utils/util";
import { BaseContext, BaseContractService } from "../BaseService";
import { getFeeRatio } from "../feeRatioService";
import { encryptOrderNote, encryptPartialNote } from "../noteCryptoService";

class RetailDepositCreateMarketPartialOrderContext extends BaseContext {
    private _orderNote?: DarkSwapOrderNote;
    private _partialInNote?: DarkSwapPartialNote;
    private _leftOverOrderNote?: DarkSwapPartialNote;
    private _leftOverInNote?: DarkSwapPartialNote;
    private _proof?: RetailDepositCreateMarketPartialOrderProofResult;

    private _inAsset?: string;
    private _minOutAmount?: bigint;
    private _inAssetDecimal?: bigint;
    private _outAssetDecimal?: bigint;
    private _minOutInSwapPrice?: bigint;

    constructor(signature: string, cryptoContext: NoteCryptoContext) {
        super(signature);
        this.noteCryptoContext = cryptoContext;
    }

    set orderNote(v: DarkSwapOrderNote | undefined) { this._orderNote = v; }
    get orderNote() { return this._orderNote; }

    set partialInNote(v: DarkSwapPartialNote | undefined) { this._partialInNote = v; }
    get partialInNote() { return this._partialInNote; }

    set leftOverOrderNote(v: DarkSwapPartialNote | undefined) { this._leftOverOrderNote = v; }
    get leftOverOrderNote() { return this._leftOverOrderNote; }

    set leftOverInNote(v: DarkSwapPartialNote | undefined) { this._leftOverInNote = v; }
    get leftOverInNote() { return this._leftOverInNote; }

    set inAsset(v: string | undefined) { this._inAsset = v; }
    get inAsset() { return this._inAsset; }

    set minOutAmount(v: bigint | undefined) { this._minOutAmount = v; }
    get minOutAmount() { return this._minOutAmount; }

    set inAssetDecimal(v: bigint | undefined) { this._inAssetDecimal = v; }
    get inAssetDecimal() { return this._inAssetDecimal; }

    set outAssetDecimal(v: bigint | undefined) { this._outAssetDecimal = v; }
    get outAssetDecimal() { return this._outAssetDecimal; }

    set minOutInSwapPrice(v: bigint | undefined) { this._minOutInSwapPrice = v; }
    get minOutInSwapPrice() { return this._minOutInSwapPrice; }

    set proof(v: RetailDepositCreateMarketPartialOrderProofResult | undefined) { this._proof = v; }
    get proof() { return this._proof; }
}

export class RetailDepositCreateMarketPartialOrderService extends BaseContractService {
    constructor(_darkSwap: DarkSwap) {
        super(_darkSwap);
    }

    private getPartialAssetManagerAddress(): string {
        const addr = this._darkSwap.contracts.darkSwapPartialAssetManager;
        if (!addr || addr === "0x0") {
            throw new DarkSwapError("darkSwapPartialAssetManager 未配置：无法执行 retailDepositCreateMarketPartialOrder");
        }
        return addr;
    }

    public async prepare(
        address: string,
        outAsset: string,
        outAmount: bigint,
        inAsset: string,
        minOutAmount: bigint,
        inAssetDecimal: bigint,
        outAssetDecimal: bigint,
        minOutInSwapPrice: bigint,
        signature: string,
        cryptoContext: NoteCryptoContext,
        version: number = DEFAULT_VERSION
    ): Promise<{
        context: RetailDepositCreateMarketPartialOrderContext;
        orderNote: DarkSwapOrderNote;
        partialInNote: DarkSwapPartialNote;
        leftOverOrderNote: DarkSwapPartialNote;
        leftOverInNote: DarkSwapPartialNote;
        swapMessage: DarkSwapBobMarketPartialOrderMessage;
    }> {
        const [pubKey, privKey] = await generateKeyPair(signature);
        const feeRatio = BigInt(await getFeeRatio(address, this._darkSwap));

        const orderNote = createOrderNoteExt(address, outAsset, outAmount, feeRatio, pubKey);
        const partialInNote = createPartialNote(address, inAsset);
        const leftOverOrderNote = createPartialNote(address, outAsset);
        const leftOverInNote = createPartialNote(address, inAsset);

        const context = new RetailDepositCreateMarketPartialOrderContext(signature, cryptoContext);
        context.address = address;
        context.orderNote = orderNote;
        context.partialInNote = partialInNote;
        context.leftOverOrderNote = leftOverOrderNote;
        context.leftOverInNote = leftOverInNote;
        context.inAsset = inAsset;
        context.minOutAmount = minOutAmount;
        context.inAssetDecimal = inAssetDecimal;
        context.outAssetDecimal = outAssetDecimal;
        context.minOutInSwapPrice = minOutInSwapPrice;

        const swapMessage = await generateRetailMarketPartialOrderMessage(
            address,
            orderNote,
            inAsset,
            minOutAmount,
            inAssetDecimal,
            outAssetDecimal,
            minOutInSwapPrice,
            partialInNote,
            leftOverOrderNote,
            leftOverInNote,
            pubKey,
            privKey,
            version
        );

        return { context, orderNote, partialInNote, leftOverOrderNote, leftOverInNote, swapMessage };
    }

    private async generateProof(context: RetailDepositCreateMarketPartialOrderContext): Promise<void> {
        if (
            !context ||
            !context.orderNote ||
            !context.partialInNote ||
            !context.leftOverOrderNote ||
            !context.leftOverInNote ||
            !context.address ||
            !context.signature ||
            !context.inAsset ||
            context.minOutAmount === undefined ||
            context.inAssetDecimal === undefined ||
            context.outAssetDecimal === undefined ||
            context.minOutInSwapPrice === undefined
        ) {
            throw new DarkSwapError("Invalid context");
        }

        const proof = await generateRetailDepositCreateMarketPartialOrderProof({
            address: context.address,
            signedMessage: context.signature,
            depositOutNote: context.orderNote,
            inAsset: context.inAsset,
            minOutAmount: context.minOutAmount,
            inAssetDecimal: context.inAssetDecimal,
            outAssetDecimal: context.outAssetDecimal,
            minOutInSwapPrice: context.minOutInSwapPrice,
            partialInNote: context.partialInNote,
            leftOverOrderNote: context.leftOverOrderNote,
            leftOverInNote: context.leftOverInNote,
        });

        context.proof = proof;
    }

    public async allowance(context: RetailDepositCreateMarketPartialOrderContext) {
        if (!context || !context.orderNote || !context.address || !context.signature || !context.proof) {
            throw new DarkSwapError("Invalid context");
        }
        if (isNativeAsset(context.orderNote.asset)) {
            return;
        }
        const spender = this.getPartialAssetManagerAddress();
        const signer = this._darkSwap.signer;
        const asset = context.orderNote.asset;
        const amount = context.orderNote.amount;

        const allowanceContract = new ethers.Contract(asset, ERC20Abi.abi, this._darkSwap);
        const allowance = await allowanceContract.allowance(signer.getAddress(), spender);
        if (BigInt(allowance) < amount) {
            const isLegacy =
                legacyTokenConfig.hasOwnProperty(this._darkSwap.chainId) &&
                legacyTokenConfig[this._darkSwap.chainId].includes(asset.toLowerCase());
            const contract = new ethers.Contract(asset, isLegacy ? ERC20_USDT.abi : ERC20Abi.abi, signer);
            const tx = await contract.approve(spender, hexlify32(MAX_ALLOWANCE));
            await tx.wait(getConfirmations(this._darkSwap.chainId));
        }
    }

    public async execute(context: RetailDepositCreateMarketPartialOrderContext): Promise<string> {
        await this.generateProof(context);
        if (
            !context ||
            !context.orderNote ||
            !context.partialInNote ||
            !context.leftOverOrderNote ||
            !context.leftOverInNote ||
            !context.proof ||
            !context.noteCryptoContext
        ) {
            throw new DarkSwapError("Invalid context");
        }

        const encryptedOrderNote = encryptOrderNote(context.orderNote, context.noteCryptoContext);
        const encryptedPartialInNote = encryptPartialNote(context.partialInNote, context.noteCryptoContext);
        const encryptedLeftOverOrderNote = encryptPartialNote(context.leftOverOrderNote, context.noteCryptoContext);
        const encryptedLeftOverInNote = encryptPartialNote(context.leftOverInNote, context.noteCryptoContext);

        const contract = new ethers.Contract(this.getPartialAssetManagerAddress(), DarkSwapPartialAssetManagerAbi.abi, this._darkSwap.signer);

        let ethAmount = 0n;
        if (isNativeAsset(context.orderNote.asset)) {
            ethAmount = context.orderNote.amount;
        } else {
            await this.allowance(context);
        }

        const tx = await contract.retailDepositCreateMarketPartialOrder(
            [
                hexlify32(context.orderNote.note),
                context.proof.depositOutNoteFooter,
                context.orderNote.asset,
                bn_to_0xhex(context.orderNote.amount),
                context.proof.partialInNoteFooter,
                context.proof.leftOverOrderNoteFooter,
                context.proof.leftOverInNoteFooter,
                [encryptedOrderNote, encryptedPartialInNote, encryptedLeftOverOrderNote, encryptedLeftOverInNote],
            ],
            context.proof.proof,
            { value: ethAmount }
        );
        await tx.wait();
        return tx.hash;
    }
}

