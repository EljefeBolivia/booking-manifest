const main = () => {
  console.log("starting main");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";

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
  const fareharborManifestFile = fareharborManifestInput.files[0];

  const apiKeyInput = document.getElementById("openai-api-key");
  const apiKey = apiKeyInput.value;

  if (!fareharborManifestFile || !apiKey) {
    return;
  }

  if (fareharborManifestFile) {
    console.log("converting FareHarbor manifest from PDF to PNG in base64");
    const fareharborManifestImage = await convertPDFToImage(
      fareharborManifestFile
    );

    await readImageWithGPT(fareharborManifestImage, apiKey);

    // if input manifest as PNG:
    //
    // const fileReader = new FileReader();
    // fileReader.onload = async () =>
    //   await readImageWithGPT(fileReader.result, apiKey);
    //
    // console.log("encoding FareHarbor manifest in base64");
    // fileReader.readAsDataURL(fareharborManifestImage);
  }
};

const convertPDFToImage = async (pdfFile) => {
  const pdfURL = URL.createObjectURL(pdfFile);

  const loadingTask = pdfjsLib.getDocument(pdfURL);
  const loadedPDF = await loadingTask.promise;

  const firstPage = await loadedPDF.getPage(1);
  var pdfViewport = firstPage.getViewport({ scale: 1 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = pdfViewport.height;
  canvas.width = pdfViewport.width;

  const task = firstPage.render({
    canvasContext: context,
    viewport: pdfViewport,
  });
  await task.promise;

  return canvas.toDataURL();
};

const readImageWithGPT = async (base64Image, apiKey) => {
  showLoader();
  const payloadForGPT = createPayloadForGPT(base64Image);

  sendRequestToGPT(apiKey, payloadForGPT)
    .then(extractBookingInformation)
    .then(printManifest)
    .catch(handleError)
    .finally(() => {
      hideLoader();
      console.log("done reading image with GPT");
    });
};

const handleError = (error) => {
  alert("Uh-oh something went wrong :(");
  console.error("error: " + error.message);
};

const createHeadersForGPT = (apiKey) => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

const createPayloadForGPT = (base64Image) => {
  return {
    model: "gpt-4o",
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
              url: base64Image,
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  };
};

const getPrompt = () => {
  return `
    The given image is a booking manifest, with relevant information on the left half of the manifest.

    Based on the relevant information in the booking manifest, reply with only a JSON object in the format below. All field values must be strings unless specified otherwise. Use the exact same keys. The values shown in the format contain some description on how to structure them. If a field value is not present in the manifest, use an appropriate empty value (e.g. blank string for string, 0 for integer, false for boolean).

    Note that the contact person listed on the top left-hand side may be listed as one of the customers below. Do not create two customers object since they are the same person.

    Do not add newline characters, the text "json", or any other unnecessary information. Your reply must be parsable by JavaScript's JSON.parse().

    <start of format>
    {
      "booking_id": "# and some digits"
      "is_shuttle": boolean (true if "Half/Full Day Shuttle" is mentioned),
      "booking_date": "dd/MM/yyyy",
      "booking_time: "HH am - HH pm",
      "is_at_field_of_dreams": boolean,
      "customers": [
        {
          "name": "customer Firstname LastName",
          "phone": "variable number of digits listed on the top left-hand side, near contact person name and email",
          "email": "customer_email@domain.com",
          "is_nelson_mtb_club_member": boolean,
          "paid": boolean,
          "is_waiver_signed": boolean
        }
      ],
      "is_private_session": boolean,
      "topic_preference": "refer to Topic Preference",
      "need_to_rent_bike": boolean,
      "is_full_day": boolean
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

  // const response = await fetch("mock_gpt_response.json");
  const response = await fetch(gptURL, requestOptions);

  console.log("received response from GPT");
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
  const loaderBackground = document.getElementById("loader-background");
  loaderBackground.classList.add("display");
};

const hideLoader = () => {
  console.log("hiding loader");
  const loader = document.getElementById("loader");
  loader.classList.remove("display");
  const loaderBackground = document.getElementById("loader-background");
  loaderBackground.classList.remove("display");
};

const delay = (milliseconds) => {
  console.log(`wait for ${milliseconds}ms`);
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const printManifest = async (booking) => {
  console.log("filling out manifest template with booking information");

  const printWindow = window.open("");
  const isShuttle = booking["is_shuttle"];
  const manifestTemplate = await getManifestTemplate(isShuttle);

  printWindow.document.write(manifestTemplate);
  printWindow.document.title = "gravity_nelson-booking" + booking["booking_id"];

  appendTextInElement(printWindow, "date", booking["booking_date"]);
  appendTextInElement(printWindow, "time", booking["booking_time"]);

  const location = booking["is_at_field_of_dreams"] ? "Field of Dreams" : "";
  appendTextInElement(printWindow, "location", location);
  appendTextInElement(printWindow, "meeting-point", location);

  fillOutCustomerInformation(printWindow, booking.customers);

  appendTextInElement(
    printWindow,
    "number-of-people",
    booking.customers.length
  );

  if (isShuttle) {
    appendTextInElement(
      printWindow,
      "full-or-half-day",
      booking["is_full_day"] ? "full day" : "half day"
    );
  } else {
    appendTextInElement(printWindow, "topic", booking["topic_preference"]);

    appendTextInElement(
      printWindow,
      "rental-bike",
      booking["need_to_rent_bike"] ? "yes" : "no"
    );

    appendTextInElement(
      printWindow,
      "public-or-private",
      booking["is_private_session"] ? "private" : "public"
    );
  }

  await delay(50);

  printWindow.print();
  printWindow.close();
};

const getManifestTemplate = async (isShuttle) => {
  console.log("retrieving manifest template");
  const templateFileName = isShuttle
    ? "template_shuttle.html"
    : "template_coaching.html";
  return await fetch(templateFileName).then((response) => response.text());
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
    ${customer.paid ? "yes" : "no"}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
    >
    ${customer["is_waiver_signed"] ? "yes" : "no"}
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
