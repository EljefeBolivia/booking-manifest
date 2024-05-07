const main = () => {
  const generateManifestButton = document.getElementById(
    "generate-manifest-button"
  );

  generateManifestButton.onclick = generateManifest;
};

const generateManifest = async () => {
  const manifestTemplate = await getManifestTemplate();
  const booking = await getBooking();

  const printWindow = fillOutManifestForPrint(manifestTemplate, booking);
  printWindow.print();
  printWindow.close();
};

const getManifestTemplate = async () => {
  return await fetch("template_coaching.html").then((response) =>
    response.text()
  );
};

// TODO: use actual data
const getBooking = async () => {
  return await fetch("mock_booking_1.json").then((response) => response.json());
};

const fillOutManifestForPrint = (manifestTemplate, booking) => {
  const printWindow = window.open("", "_blank");
  printWindow.document.write(manifestTemplate);

  appendTextInElement(printWindow, "date", booking.date);
  appendTextInElement(printWindow, "location", booking.location);
  appendTextInElement(printWindow, "time", booking.time);

  appendTextInElement(printWindow, "meeting-point", booking["meeting_point"]);
  appendTextInElement(printWindow, "coach", booking.coach);

  fillOutCustomerInformation(printWindow, booking.customers);

  const bookingInformation = booking["booking_information"];

  appendTextInElement(
    printWindow,
    "number-of-people",
    bookingInformation["number_of_people"]
  );
  appendTextInElement(printWindow, "topic", bookingInformation.topic);

  appendTextInElement(
    printWindow,
    "public-or-private",
    bookingInformation["is_private_lesson"] ? "private" : "public"
  );
  appendTextInElement(
    printWindow,
    "rental-bike",
    bookingInformation["rental_bike"]
  );

  return printWindow;
};

const appendTextInElement = (printWindow, elementId, text) => {
  const element = printWindow.document.getElementById(elementId);
  element.innerText = element.innerText + " " + text;
};

const fillOutCustomerInformation = (printWindow, customers) => {
  const customerInfoSection = printWindow.document.getElementById(
    "customer-information"
  );

  for (const customer of customers) {
    const customerRow = createCustomerRow(customer);
    customerInfoSection.innerHTML = customerInfoSection.innerHTML + customerRow;
  }

  const maxNumberOfCustomers = 10;
  const remainingNumberOfRows = maxNumberOfCustomers - customers.length;

  for (let index = 0; index < remainingNumberOfRows; ++index) {
    const blankCustomerRow = createBlankCustomerRow();
    customerInfoSection.innerHTML =
      customerInfoSection.innerHTML + blankCustomerRow;
  }
};

const createCustomerRow = (customer) => {
  return `
  <div class="manifest-row">
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    ${customer.name}
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    ${customer.phone}
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    ${customer.email}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    ${customer.nmtbc ? "yes" : "no"}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    ${customer.paid}
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left border-right"
    >
    ${customer.waiver}
    </div>
  </div>
  `;
};

const createBlankCustomerRow = () => {
  return `
  <div class="manifest-row">
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
    >
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    </div>
    <div
      class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left border-right"
    >
    </div>
  </div>
  `;
};

main(); // program is ran here
