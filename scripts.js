const main = () => {
  const generateManifestButton = document.getElementById(
    "generate-manifest-button"
  );

  if (generateManifestButton) {
    generateManifestButton.onclick = generateManifest;
  }

  const printManifestButton = document.getElementById("print-manifest-button");

  if (printManifestButton) {
    printManifestButton.onclick = printManifest;
  }
};

const generateManifest = async () => {
  const manifestTemplate = await retrieveManifestTemplate();
  const manifest = fillOutManifest(manifestTemplate, "");
  printManifest(manifest);
};

const retrieveManifestTemplate = async () => {
  return await fetch("template_coaching.html").then((html) => html.text());
};

const fillOutManifest = (manifestTemplate, manifestContent) => {
  return manifestTemplate;
};

const printManifest = (manifest) => {
  const printWindow = window.open("", "_blank");
  printWindow.document.write(manifest);
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
