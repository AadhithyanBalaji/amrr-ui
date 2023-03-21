import { DatePipe, DecimalPipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { ConsolidatedStockReport } from '../reports/consolidated-stock-report/consolidated-stock-report.model';
import { CSRExportData } from './csr-export-data.model';
import { CSRExportRow } from './csr-export-row.model';
import Helper from './helper';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

@Injectable()
export class PdfService {
  reportData: ConsolidatedStockReport[] = [];
  itemGroups: any[] = [];
  bags = 0;
  qty = 0;
  exporting = false;

  constructor(
    private readonly decimalPipe: DecimalPipe,
    private readonly datePipe: DatePipe,
    private readonly snackBar: MatSnackBar
  ) {}

  exportAsPdf(data: CSRExportData) {
    if (
      Helper.isTruthy(data) &&
      Helper.isTruthy(data.reportData) &&
      data.reportData.length > 0
    ) {
      this.exporting = true;
      this.reportData = data.reportData;
      const documentDefinition = this.getCSRContent(data);
      pdfMake.createPdf(documentDefinition as any).open();
      this.exporting = false;
    } else {
      this.snackBar.open('No data to export');
    }
  }

  private getCSRContent(data: CSRExportData) {
    const itemGroupwiseTable = this.getItemGroupwiseTable();
    const itemwiseTable = this.getItemwiseTable();
    const unsortedInwardData = data.itemRows.filter(
      (x) =>
        x.transactionTypeId === 1 || (x.transactionTypeId === 3 && x.qty > 0)
    );
    const inwardData = this.sortByItemGroup(unsortedInwardData);

    const unsortedOutwardData = data.itemRows.filter(
      (x) =>
        x.transactionTypeId === 2 || (x.transactionTypeId === 3 && x.qty < 0)
    );
    const outwardData = this.sortByItemGroup(unsortedOutwardData);

    return {
      info: {
        title: `Consolidated_StockReport_${
          data.godown === 'All' ? 'All_GODOWNS' : data.godown
        }`,
        author: 'AMRR',
        subject: 'AMRR Transaction report for the selected criteria',
        keywords: 'amrr transactions report',
      },
      content: [
        {
          text: this.buildPdfTitle(data),
          style: 'header',
          alignment: 'center',
        },
        {
          alignment: 'justify',
          columns: [itemwiseTable, itemGroupwiseTable],
        },
        inwardData.length > 0 ? this.getStockTable(true, inwardData) : {},
        outwardData.length > 0 ? this.getStockTable(false, outwardData) : {},
      ],
      styles: this.getPdfStyles(),
      defaultStyle: {
        columnGap: 20,
        color: 'black',
      },
    };
  }

  private sortByItemGroup(unsortedData: CSRExportRow[]) {
    let data: CSRExportRow[] = [];
    this.itemGroups.forEach((itemGroup) => {
      data.push(
        ...unsortedData.filter(
          (x: CSRExportRow) => x.itemGroup === itemGroup.key
        )
      );
    });
    return data;
  }

  private buildPdfTitle(data: CSRExportData) {
    const fromDate =
      data.fromDate.split(' ').length > 0
        ? this.datePipe.transform(data.fromDate.split(' ')[0], 'dd-MM-YYYY')
        : '';
    const toDate =
      data.toDate.split(' ').length > 0
        ? this.datePipe.transform(data.toDate.split(' ')[0], 'dd-MM-YYYY')
        : '';
    return `${data.godown === 'All' ? 'All GODOWNS' : data.godown} ${
      fromDate === toDate ? fromDate : fromDate + ' to ' + toDate
    }`;
  }

  private getItemGroupwiseTable() {
    const groups = this.groupBy(this.reportData, 'itemGroup');
    let totalQty = 0,
      totalBags = 0;
    this.itemGroups = [];
    Object.keys(groups).forEach((key) => {
      const bags = groups[key].reduce(function (acc: any, obj: any) {
        return acc + obj.closingBags;
      }, 0);
      const qty = groups[key].reduce(function (acc: any, obj: any) {
        return acc + obj.closingQty;
      }, 0);
      totalBags += bags;
      totalQty += qty;
      this.itemGroups.push({ key: key, bags: bags, qty: qty });
    });
    this.itemGroups.sort((a: any, b: any) => b.qty - a.qty);
    const tableRows = this.itemGroups.map((tableRow: any) =>
      this.addRow(tableRow.key, tableRow.bags, tableRow.qty)
    );
    tableRows.push(this.addRow('Total', totalBags, totalQty));

    return {
      style: 'tableExample',
      table: {
        keepWithHeaderRows: true,
        dontBreakRows: true,
        widths: ['*', 60, 60],
        headerRows: 2,
        body: [
          [
            {
              text: 'Item Groupwise stock',
              style: 'tableMainHeader',
              colSpan: 3,
              alignment: 'center',
            },
            {},
            {},
          ],
          [
            {
              text: 'Item Group',
              style: 'tableHeader',
              alignment: 'left',
            },
            { text: 'Bags', style: 'tableHeader', alignment: 'right' },
            { text: 'Qty', style: 'tableHeader', alignment: 'right' },
          ],
          ...tableRows,
        ],
      },
    };
  }

  private getItemwiseTable() {
    const tableRows = [];
    let totalBags = 0,
      totalQty = 0;
    this.itemGroups.forEach((element) => {
      this.reportData
        .filter((x: any) => x.itemGroup === element.key)
        .sort(
          (a: ConsolidatedStockReport, b: ConsolidatedStockReport) =>
            b.closingQty - a.closingQty
        )
        .forEach((reportRow) => {
          totalBags += reportRow.closingBags;
          totalQty += reportRow.closingQty;
          tableRows.push(
            this.addRow(
              reportRow.itemName,
              reportRow.closingBags,
              reportRow.closingQty
            )
          );
        });
    });

    tableRows.push(this.addRow('Total', totalBags, totalQty));

    return {
      keepWithHeaderRows: true,
      dontBreakRows: true,
      style: 'tableExample',

      table: {
        widths: ['auto', 60, 60],
        headerRows: 2,
        body: [
          [
            {
              text: 'Itemwise stock',
              style: 'tableMainHeader',
              colSpan: 3,
              alignment: 'center',
            },
            {},
            {},
          ],
          [
            {
              text: 'Item',
              style: 'tableHeader',
              alignment: 'left',
            },
            { text: 'Bags', style: 'tableHeader', alignment: 'right' },
            { text: 'Qty', style: 'tableHeader', alignment: 'right' },
          ],
          ...tableRows,
        ],
      },
    };
  }

  private getStockTable(isInward: boolean, rows: CSRExportRow[]) {
    const itemsGroup = this.groupBy(rows, 'item');
    const tables: any[] = [];

    const itemNames = Object.keys(itemsGroup);
    for (let i = 0; i + 1 < itemNames.length; i = i + 2) {
      tables.push(
        this.buildColumn(
          itemNames[i],
          itemsGroup[itemNames[i]],
          itemNames[i + 1],
          itemsGroup[itemNames[i + 1]],
          isInward
        )
      );
    }
    if (itemNames.length % 2 === 1) {
      tables.push(
        this.buildColumn(
          itemNames[itemNames.length - 1],
          itemsGroup[itemNames[itemNames.length - 1]],
          undefined,
          undefined,
          isInward
        )
      );
    }

    return [
      {
        table: {
          style: 'noBorder',
          widths: ['*'],
          headerRows: 1,
          body: [
            [
              {
                text: isInward ? 'Stock In List' : 'Delivery list',
                style: 'transactionsHeader',
                alignment: 'center',
              },
            ],
          ],
        },
      },
      ...tables,
    ];
  }

  private buildColumn(
    itemName: string,
    items: CSRExportRow[],
    itemName2?: string,
    items2?: CSRExportRow[],
    isInward = false
  ) {
    return {
      columns: [
        this.getTransactionsTable(itemName, items, isInward),
        itemName2 !== undefined
          ? this.getTransactionsTable(itemName2!, items2!, isInward)
          : {},
      ],
    };
  }

  private getTransactionsTable(
    item: string,
    itemData: CSRExportRow[],
    isInward: boolean
  ) {
    const reportItem = this.reportData.find((x) => x.itemName === item);
    let openingBags = reportItem?.openingBags ?? 0;
    if (!isInward) {
      openingBags +=
        (reportItem?.inwardBags ?? 0) + (reportItem?.gainBags ?? 0);
    }

    let openingQty = reportItem?.openingQty ?? 0;
    if (!isInward) {
      openingQty += (reportItem?.inwardQty ?? 0) + (reportItem?.gainQty ?? 0);
    }

    this.bags = 0;
    this.qty = 0;

    const rows = itemData.map((a) => {
      this.bags += a.bags;
      this.qty += a.qty;
      return this.addRow(a.partyName, a.bags, a.qty);
    });

    return {
      style: 'tableExample',

      table: {
        keepWithHeaderRows: true,
        dontBreakRows: true,
        widths: ['*', 60, 60],
        headerRows: 2,
        body: [
          [
            {
              text: item,
              style: 'tableMainHeader',
              colSpan: 3,
              alignment: 'center',
            },
            {},
            {},
          ],
          [
            { text: '', style: 'tableHeader' },
            { text: 'Bags', style: 'tableHeader', alignment: 'right' },
            { text: 'Quantity', style: 'tableHeader', alignment: 'right' },
          ],
          this.addRow('Opening', openingBags, openingQty),
          ...rows,
          this.addRow(
            'Closing',
            openingBags + this.bags,
            openingQty + this.qty
          ),
        ],
      },
    };
  }

  private addRow(col1: string, bags: number, qty: number) {
    return [
      {
        text: col1,
        style:
          col1 === 'Opening' || col1 === 'Closing' ? 'closingCell' : 'dataCell',
        alignment: 'left',
      },
      {
        text: this.decimalPipe.transform(Math.abs(bags), '1.0-0'),
        style:
          col1 === 'Opening' || col1 === 'Closing' ? 'closingCell' : 'dataCell',
        alignment: 'right',
      },
      {
        text: this.decimalPipe.transform(Math.abs(qty), '1.2-2'),
        style:
          col1 === 'Opening' || col1 === 'Closing' ? 'closingCell' : 'dataCell',
        alignment: 'right',
      },
    ];
  }

  private getPdfStyles() {
    return {
      header: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      tableExample: {
        margin: [0, 5, 0, 15],
        fontSize: 10,
        color: 'black',
      },
      tableHeader: {
        fontSize: 10,
        color: 'black',
        alignment: 'center',
      },
      tableMainHeader: {
        color: 'black',
        fillColor: '#cccccc',
        bold: true,
      },
      transactionsHeader: {
        fillColor: '#cccccc',
        bold: true,
      },
      noBorder: {
        border: [false, false, false, false],
      },
      defaultCell: {
        color: 'black',
      },
      closingCell: {
        fillColor: '#cccccc',
        color: 'black',
      },
    };
  }

  private groupBy = function (xs: any, key: any) {
    return xs.reduce(function (rv: any, x: any) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };
}
