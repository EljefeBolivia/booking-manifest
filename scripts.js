const main = () => {
  const generateManifestButton = document.getElementById(
    "generate-manifest-button"
  );

  if (generateManifestButton) {
    generateManifestButton.onclick = fillOutManifest;
  }

  const printManifestButton = document.getElementById("print-manifest-button");

  if (printManifestButton) {
    printManifestButton.onclick = printManifest;
  }
};

const fillOutManifest = () => {
  console.log("TODO");
};

const printManifest = () => {
  const printWindow = window.open("", "_blank");

  const manifest = document.getElementById("manifest");
  printWindow.document.write(
    '<html><head><title>Print it!</title><link rel="stylesheet" type="text/css" href="../styles.css"></head><body>'
  );
  printWindow.document.write(manifest.outerHTML);
  printWindow.document.write("</body></html>");
  printWindow.print();

  printWindow.close();
};

// const generateTripSheet = () => {
//   const data = [[]];
//   const worksheet = XLSX.utils.aoa_to_sheet(data);

//   // s: start, e: end, r: row, c: column
//   const cellMerges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

//   worksheet["!merges"] = cellMerges;

//   createWorkbook(worksheet);
// };

// const createWorkbook = (worksheet) => {
//   const workbook = XLSX.utils.book_new(worksheet, "worksheet_TODO_name");
//   const filename = "booking_trip_sheet_TODO_name.xlsx";
//   XLSX.writeFileXLSX(workbook, filename, { compression: true });
// };

main(); // program is ran here
