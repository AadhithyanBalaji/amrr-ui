import { TransactionBatch } from "./transaction-batch.model";

export class Transaction{
    batches: TransactionBatch[];
    transationId: number;
    transactionTypeId: number;
    invoiceNo: string;
    partyName: string;
    vehicleName: string;
    vehicleRegNo: string;
    weightMeasureType: number;
    remarks: string;
    verifiedBy: string;
    transactionDate: Date;
  transaction: any;
}