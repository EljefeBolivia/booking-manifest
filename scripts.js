const main = () => {
  console.log("starting main");
  const generateManifestButton = document.getElementById(
    "generate-manifest-button"
  );

  generateManifestButton.onclick = () => generateManifest();
};

const generateManifest = async () => {
  console.log("generating manifest");

  const fareharborManifestInput = document.getElementById(
    "fareharbor-manifest"
  );
  const fareharborManifest = fareharborManifestInput.files[0];

  const apiKeyInput = document.getElementById("openai-api-key");
  const apiKey = apiKeyInput.value;
  console.log("API key: " + apiKey);

  if (!fareharborManifest || !apiKey) {
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = async () =>
    await readImageWithGPT(fileReader.result, apiKey);

  if (fareharborManifest) {
    console.log("encoding FareHarbor manifest in base64");
    fileReader.readAsDataURL(fareharborManifest);
  }
};

const readImageWithGPT = async (base64Image, apiKey) => {
  showLoader();
  const payloadForGPT = createPayloadForGPT(base64Image);

  const response = await sendRequestToGPT(apiKey, payloadForGPT);
  const booking = extractBookingInformation(response);
  const printWindow = await fillOutManifestForPrint(booking);

  printWindow.print();
  printWindow.close();

  hideLoader();
  console.log("done reading image with GPT");
};

const createHeadersForGPT = (apiKey) => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

const createPayloadForGPT = (base64Image) => {
  return {
    model: "gpt-4-turbo",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: getPrompt(),
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image, // TODO: handle PDF
            },
          },
        ],
      },
    ],
    max_tokens: 300,
  };
};

const getPrompt = () => {
  return `
    The given image is a booking manifest, with relevant information on the left half of the manifest.

    Based on the relevant information in the booking manifest, reply with only a JSON object in the format below. All field values must be strings unless specified otherwise. Use the exact same keys. The values shown in the format contain some description on how to structure them.

    Do not add newline characters, the text "json", or any other unnecessary information. Your reply must be parsable by JavaScript's JSON.parse()

    <start of format>
    {
      "booking_date": "dd/MM/yyyy",
      "booking_time: "HH (am) - HH (pm)",
      "is_at_field_of_dreams": boolean,
      "customers": [
        {
          "name": "customer Firstname LastName",
          "phone": "variable number of digits listed on the top left-hand side, near name and email",
          "email": "customer_email@domain.com",
          "is_nelson_mtb_club_member": boolean,
          "paid": boolean,
          "is_waiver_signed": boolean
        }
      ],
      "is_private_session": boolean,
      "number_of_people": integer,
      "topic_preference": "refer to Topic Preference",
      "need_to_rent_bike": boolean
    }
    <end of format>
  `;
};

const sendRequestToGPT = async (apiKey, payload) => {
  console.log("sending request to GPT");
  const headers = createHeadersForGPT(apiKey);

  const gptURL = "https://api.openai.com/v1/chat/completions";
  const requestOptions = {
    method: "post",
    headers: headers,
    body: JSON.stringify(payload),
  };

  const response = await fetch(gptURL, requestOptions);
  // const response = await fetch("mock_gpt_response.json");

  console.log("received response from GPT: " + response);
  return await response.json();
};

const extractBookingInformation = (gptResponse) => {
  console.log("extracting booking information from GPT response");
  const gptMessage = gptResponse.choices[0].message.content;
  return JSON.parse(gptMessage);
};

const showLoader = () => {
  console.log("showing loader");

  const loader = document.getElementById("loader");
  loader.classList.add("display");
};

const hideLoader = () => {
  console.log("hiding loader");

  const loader = document.getElementById("loader");
  loader.classList.remove("display");
};

const delay = (milliseconds) => {
  console.log(`wait for ${milliseconds}ms`);
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getManifestTemplate = async () => {
  console.log("retrieving manifest template");
  return await fetch("template_coaching.html").then((response) =>
    response.text()
  );
};

const fillOutManifestForPrint = async (booking) => {
  console.log("filling out manifest template with booking information");
  const manifestTemplate = await getManifestTemplate();

  const printWindow = window.open("");
  printWindow.document.write(manifestTemplate);

  appendTextInElement(printWindow, "date", booking["booking_date"]);
  appendTextInElement(
    printWindow,
    "location",
    booking["is_at_field_of_dreams"] ? "Field of Dreams" : ""
  );
  appendTextInElement(printWindow, "time", booking["booking_time"]);

  // appendTextInElement(printWindow, "meeting-point", booking["meeting_point"]);
  // appendTextInElement(printWindow, "coach", booking.coach);

  fillOutCustomerInformation(printWindow, booking.customers);

  appendTextInElement(
    printWindow,
    "number-of-people",
    booking["number_of_people"]
  );
  appendTextInElement(printWindow, "topic", booking["topic_preference"]);

  appendTextInElement(
    printWindow,
    "public-or-private",
    booking["is_private_session"] ? "private" : "public"
  );
  appendTextInElement(
    printWindow,
    "rental-bike",
    booking["need_to_rent_bike"] ? "yes" : "no"
  );

  await delay(50);
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

  const maxNumRows = 10;
  const numRowsToFill = Math.min(customers.length, maxNumRows);

  for (let index = 0; index < numRowsToFill; ++index) {
    const customer = customers[index];
    const customerRow = createCustomerRow(customer);
    customerInfoSection.innerHTML = customerInfoSection.innerHTML + customerRow;
  }

  const numBlankRows = maxNumRows - numRowsToFill;

  for (let index = 0; index < numBlankRows; ++index) {
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
      class="manifest-cell manifest-field center-text thirty-percent-width border-top border-left"
    >
    ${customer.email}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    ${customer["is_nelson_mtb_club_member"] ? "yes" : "no"}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    ${customer.paid}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
    >
    ${customer["is_waiver_signed"]}
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
      class="manifest-cell manifest-field center-text thirty-percent-width border-top border-left"
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
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
    >
    </div>
  </div>
  `;
};

main(); // program is ran here
