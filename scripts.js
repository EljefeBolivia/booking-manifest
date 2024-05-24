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
    const fareharborManifestImages = await convertPDFToImages(
      fareharborManifestFile
    );

    await readImagesWithGPT(fareharborManifestImages, apiKey);

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

const convertPDFToImages = async (pdfFile) => {
  const pdfURL = URL.createObjectURL(pdfFile);

  const loadingTask = pdfjsLib.getDocument(pdfURL);
  const pdf = await loadingTask.promise;

  const pdfImages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; ++pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const base64Image = await convertPDFPageToBase64(page);

    pdfImages.push(base64Image);
  }

  return pdfImages;
};

const convertPDFPageToBase64 = async (page) => {
  var pdfViewport = page.getViewport({ scale: 1 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.height = pdfViewport.height;
  canvas.width = pdfViewport.width;

  const task = page.render({
    canvasContext: context,
    viewport: pdfViewport,
  });
  await task.promise;

  return canvas.toDataURL();
};

const readImagesWithGPT = async (base64Images, apiKey) => {
  showLoader();
  const payloadForGPT = createPayloadForGPT(base64Images);

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
  alert("Uh-oh, something went wrong :(");
  console.error("error: " + error.message);
};

const createHeadersForGPT = (apiKey) => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

const createPayloadForGPT = (base64Images) => {
  const imageMessages = base64Images.map(createImageMessage);

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
          ...imageMessages,
        ],
      },
    ],
    max_tokens: 1000,
  };
};

const createImageMessage = (image) => {
  return {
    type: "image_url",
    image_url: {
      url: image,
    },
  };
};

const getPrompt = () => {
  return `
    The given image is a booking manifest which may span multiple pages, with relevant information on the left half of the manifest.

    Based on the relevant information in the booking manifest, reply with only a JSON object in the format below. All field values must be strings unless specified otherwise. Use the exact same keys. The values shown in the format contain some description on how to structure them. If a field value is not present in the manifest, use an appropriate empty value (e.g. blank string for string, 0 for integer, false for boolean).

    Note that the contact person listed on the top left-hand side of the first page may also be listed as one of the customers below. Do not create two customers object since they are the same person. Try to ensure that the number of customers that you output is equal to the number of people listed at the top.

    Do not add newline characters, the text "json", or any other unnecessary information. Your reply must be parsable by JavaScript's JSON.parse().

    <start of format>
    {
      "booking_id": "# and some digits"
      "is_shuttle": boolean (true if "Half/Full Day Shuttle" is mentioned),
      "booking_date": "dd/MM/yyyy",
      "booking_time: "HHam - HHpm",
      "is_at_field_of_dreams": boolean,
      "total_amount_paid": float,
      "number_of_people" integer,
      "vehicle": {
        "is_4x4_hiace_mini_van": boolean,
        "is_ford_ranger": boolean,
        "is_holden_colorado": boolean,
        "is_troop_carrier": boolean
      },
      "customers": [
        {
          "name": "customer Firstname LastName",
          "phone": "variable number of digits listed on the top left-hand side, near contact person name and email address, most likely in New Zealand phone number format",
          "email": "customer_email@domain.com listed on the top left-hand side, near contact person name and phone number; may appear near waiver-signed field if present",
          "membership_number": "most likely a 5-digit number",
          "amount_paid": "show with $ sign, to two decimal places (i.e. dollars and cents; any discount would have already been applied, so do not perform any calculation and just show the value as is",
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

  // const response = await getMockGPTResponse();
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
  const printWindow = window.open("", "_blank");
  const isShuttle = booking["is_shuttle"];
  const manifestTemplate = await getManifestTemplate(isShuttle);

  console.log("filling out manifest template with booking information");
  printWindow.document.write(manifestTemplate);

  const bookingId = booking["booking_id"];
  const bookingDate = booking["booking_date"];
  const tripSheetType = isShuttle ? "Shuttle" : "Coaching";

  const fileName = `${bookingDate} ${tripSheetType} Trip Sheet ${bookingId}`;
  printWindow.document.title = fileName;

  appendTextInElement(printWindow, "date", bookingDate);
  appendTextInElement(printWindow, "time", booking["booking_time"]);

  // TODO: add other locations e.g. 629
  const location = booking["is_at_field_of_dreams"] ? "Field of Dreams" : "";
  appendTextInElement(printWindow, "location", location);
  appendTextInElement(printWindow, "meeting-point", location);

  fillOutCustomerInformation(printWindow, booking.customers);

  appendTextInElement(
    printWindow,
    "number-of-people",
    booking["number_of_people"]
  );

  if (isShuttle) {
    appendTextInElement(
      printWindow,
      "vehicle",
      getBookedVehicle(booking.vehicle)
    );

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
  return isShuttle ? getShuttleTemplate() : getCoachingTemplate();

  // const activityType = isShuttle ? "shuttle" : "coaching";
  // const templateURL = `https://github.com/EljefeBolivia/booking-manifest/blob/main/template_${activityType}.html`;
  // return await fetch(templateURL).then((response) => response.text());
};

const appendTextInElement = (printWindow, elementId, text) => {
  const element = printWindow.document.getElementById(elementId);
  element.innerText = element.innerText + " " + text;
};

const getBookedVehicle = (vehicle) => {
  if (vehicle["is_4x4_hiace_mini_van"]) {
    return "Hiace Minivan";
  } else if (vehicle["is_ford_ranger"]) {
    return "Ranger";
  } else if (vehicle["is_holden_colorado"]) {
    return "Colorado";
  } else if (vehicle["is_troop_carrier"]) {
    return "Troopie";
  } else {
    return "";
  }
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
    ${customer["membership_number"]}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
    >
    ${customer["amount_paid"]}
    </div>
    <div
      class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
    >
    ${customer["is_waiver_signed"] ? "signed in FareHarbor" : ""}
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

const getMockGPTResponse = async () => {
  await delay(1000);

  return {
    choices: [
      {
        message: {
          content:
            '{\n "booking_date": "03/01/2024",\n "booking_time": "10 am - 1 pm",\n "is_at_field_of_dreams": true,\n "customers": [\n {\n "name": "A**** W*******",\n "phone": "61*******64",\n "email": "b********@yahoo.com.au",\n "is_nelson_mtb_club_member": true,\n "paid": true,\n "is_waiver_signed": true\n }\n ],\n "is_private_session": true,\n "number_of_people": 1,\n "topic_preference": "Drops and Jumps",\n "need_to_rent_bike": false\n}',
        },
      },
    ],
  };
};

const getCoachingTemplate = () => {
  return `
<!DOCTYPE html>

<html>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <head>
    <title>Gravity Nelson NZ - Coaching Manifest Template</title>
    <link rel="icon" href="../favicon.ico" />
    <link rel="stylesheet" type="text/css" href="./styles.css" />
  </head>

  <body>
    <main id="manifest">
      <div class="manifest-page half-margin-top full-margin-bottom">
        <div class="manifest-row">
          <div
            class="manifest-cell manifest-title coaching-color full-width center-text border-top border-left border-right"
          >
            COACHING / GUIDING TRIP SHEET
          </div>
        </div>

        <div class="manifest-row">
          <div
            id="date"
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            DATE:
          </div>
          <div
            id="location"
            class="manifest-cell manifest-field half-width border-top border-left"
          >
            LOCATION:
          </div>
          <div
            id="time"
            class="manifest-cell manifest-field quarter-width border-top border-left border-right"
          >
            TIME:
          </div>
        </div>

        <div class="manifest-row">
          <div
            id="meeting-point"
            class="manifest-cell manifest-field half-width border-top border-left"
          >
            MEETING POINT:
          </div>
          <div
            id="coach"
            class="manifest-cell manifest-field half-width border-top border-left border-right"
          >
            COACH / ASSISTANT:
          </div>
        </div>

        <div id="customer-information">
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
            >
              CUSTOMER INFORMATION
            </div>
          </div>

          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
            >
              NAME
            </div>
            <div
              class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
            >
              PHONE
            </div>
            <div
              class="manifest-cell manifest-field center-text thirty-percent-width border-top border-left"
            >
              EMAIL
            </div>
            <div
              class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
            >
              NMTBC
            </div>
            <div
              class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
            >
              PAID
            </div>
            <div
              class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
            >
              WAIVER
            </div>
          </div>
        </div>

        <div id="booking-information">
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
            >
              BOOKING INFORMATION
            </div>
          </div>

          <div class="manifest-row">
            <div
              id="number-of-people"
              class="manifest-cell manifest-field half-width border-top border-left"
            >
              NUMBER OF PEOPLE:
            </div>
            <div
              id="topic"
              class="manifest-cell manifest-field half-width border-top border-left border-right"
            >
              TOPIC:
            </div>
          </div>

          <div class="manifest-row">
            <div
              id="public-or-private"
              class="manifest-cell manifest-field half-width border-top border-left"
            >
              PUBLIC / PRIVATE:
            </div>
            <div
              id="rental-bike"
              class="manifest-cell manifest-field half-width border-top border-left border-right"
            >
              RENTAL BIKE:
            </div>
          </div>

          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field half-width border-top border-left"
            >
              WEATHER FORECAST:
            </div>
            <div
              class="manifest-cell manifest-field half-width border-top border-left border-right"
            >
              TRACK CONDITIONS:
            </div>
          </div>

          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field quarter-width border-top border-left"
            >
              Ok to do current plan:
            </div>
            <div
              class="manifest-cell manifest-field three-quarter-width border-top border-left border-right"
            >
              Yes / If not:
            </div>
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            CHECKLIST (please tick if taken and fill in)
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            RIDING FIRST AID
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            TOOLS
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            KEYS
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-right"
          >
            COACHING CONES
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            PIRB
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            RADIO
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            CELL PHONE
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-right"
          >
            PAPERWORK
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            VEHICLE FIRST AID KIT
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            CAMERA
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          ></div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            PRE-RIDE SET-UP
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            SUSPENSION
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            SADDLE
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left"
          >
            HANDLEBAR
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-right"
          >
            TYRE PRESSURE
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-bottom"
          >
            BRAKE SET-UP
          </div>
          <div
            class="manifest-cell manifest-field quarter-width border-top border-left border-bottom"
          >
            HELMET
          </div>
          <div
            class="manifest-cell manifest-field half-width border-top border-left border-right border-bottom"
          >
            UNCONSCIOUS GUIDE BRIEFING
          </div>
        </div>
      </div>

      <div class="manifest-page full-margin-top half-margin-bottom">
        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            ACTIVITY NOTES
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-note full-width border-top border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            INCIDENT / ACCIDENT NOTES
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-note full-width border-top border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            NOTABLE CUSTOMER FEEDBACK
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-note full-width border-top border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            FINANCIAL SUMMARY
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          >
            Income:
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div class="manifest-cell manifest-field half-width border-left">
            Direct costs:
          </div>
          <div class="manifest-cell manifest-field half-width border-right">
            Contribution:
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            OFFICE FOLLOW-UP
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          >
            Photos uploaded by coach: date ___/___/______
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          >
            Usage fees noted: NCC ____ NMTBC ____
          </div>
        </div>
        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-field full-width border-left border-right"
          ></div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-subtitle coaching-color full-width center-text border-top border-left border-right"
          >
            SYSTEM IMPROVEMENT NOTES
          </div>
        </div>

        <div class="manifest-row">
          <div
            class="manifest-cell manifest-note full-width border-top border-left border-right border-bottom"
          ></div>
        </div>
      </div>
    </main>
  </body>
</html>
  `;
};

const getShuttleTemplate = () => {
  return `
  <!DOCTYPE html>

  <html>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
    <head>
      <title>Gravity Nelson NZ - Shuttle Manifest Template</title>
      <link rel="icon" href="../favicon.ico" />
      <link rel="stylesheet" type="text/css" href="./styles.css" />
    </head>
  
    <body>
      <main id="manifest">
        <div class="manifest-page half-margin-top full-margin-bottom">
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-title shuttle-color full-width center-text border-top border-left border-right"
            >
              SHUTTLE TRIP SHEET
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              id="date"
              class="manifest-cell manifest-field quarter-width border-top border-left"
            >
              DATE:
            </div>
            <div
              id="location"
              class="manifest-cell manifest-field half-width border-top border-left"
            >
              LOCATION:
            </div>
            <div
              id="time"
              class="manifest-cell manifest-field quarter-width border-top border-left border-right"
            >
              TIME:
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              id="meeting-point"
              class="manifest-cell manifest-field half-width border-top border-left"
            >
              MEETING POINT:
            </div>
            <div
              id="vehicle"
              class="manifest-cell manifest-field quarter-width border-top border-left"
            >
              VEHICLE:
            </div>
            <div
              id="driver"
              class="manifest-cell manifest-field quarter-width border-top border-left border-right"
            >
              DRIVER:
            </div>
          </div>
  
          <div id="customer-information">
            <div class="manifest-row">
              <div
                class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
              >
                CUSTOMER INFORMATION
              </div>
            </div>
  
            <div class="manifest-row">
              <div
                class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
              >
                NAME
              </div>
              <div
                class="manifest-cell manifest-field center-text twenty-percent-width border-top border-left"
              >
                PHONE
              </div>
              <div
                class="manifest-cell manifest-field center-text thirty-percent-width border-top border-left"
              >
                EMAIL
              </div>
              <div
                class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
              >
                NMTBC
              </div>
              <div
                class="manifest-cell manifest-field center-text ten-percent-width border-top border-left"
              >
                PAID
              </div>
              <div
                class="manifest-cell manifest-field center-text ten-percent-width border-top border-left border-right"
              >
                WAIVER
              </div>
            </div>
          </div>
  
          <div id="booking-information">
            <div class="manifest-row">
              <div
                class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
              >
                BOOKING INFORMATION
              </div>
            </div>
  
            <div class="manifest-row">
              <div
                id="number-of-people"
                class="manifest-cell manifest-field half-width border-top border-left"
              >
                NUMBER OF PEOPLE:
              </div>
              <div
                id="topic"
                class="manifest-cell manifest-field half-width border-top border-left border-right"
              >
                TRACKS & NUMBER OF RUNS:
              </div>
            </div>
  
            <div class="manifest-row">
              <div
                id="public-or-private"
                class="manifest-cell manifest-field half-width border-top border-left"
              >
                PUBLIC / PRIVATE:
              </div>
              <div
                id="rental-bike"
                class="manifest-cell manifest-field half-width border-left border-right"
              ></div>
            </div>
  
            <div class="manifest-row">
              <div
                id="full-or-half-day"
                class="manifest-cell manifest-field half-width border-top border-left"
              >
                FULL DAY / HALF DAY:
              </div>
              <div
                id="rental-bike"
                class="manifest-cell manifest-field half-width border-left border-right"
              ></div>
            </div>
  
            <div class="manifest-row">
              <div
                class="manifest-cell manifest-field half-width border-top border-left"
              >
                WEATHER FORECAST:
              </div>
              <div
                class="manifest-cell manifest-field half-width border-left border-right"
              ></div>
            </div>
  
            <div class="manifest-row">
              <div
                class="manifest-cell manifest-field quarter-width border-top border-left"
              >
                Ok to do current plan:
              </div>
              <div
                class="manifest-cell manifest-field three-quarter-width border-top border-left border-right"
              >
                Yes / If not:
              </div>
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              CHECKLIST (please tick if taken and fill in)
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              RIDING FIRST AID
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              TOOLS
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              KEYS
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              COF
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              PIRB
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              RADIO
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              CELL PHONE
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              REGO
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              PAPERWORK
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              VEHICLE FIRST AID KIT
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              CAMERA
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left"
            >
              RUC / KM
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-bottom"
            >
              PRE-DRIVE CHECK
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-bottom"
            >
              LOGMATE
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-bottom"
            >
              SHOVEL
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-bottom"
            >
              SAW
            </div>
            <div
              class="manifest-cell manifest-field twenty-percent-width border-top border-left border-bottom border-right"
            ></div>
          </div>
        </div>
  
        <div class="manifest-page full-margin-top half-margin-bottom">
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              ACTIVITY NOTES
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-note full-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              INCIDENT / ACCIDENT NOTES
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-note full-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              NOTABLE CUSTOMER FEEDBACK
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-note full-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              FINANCIAL SUMMARY
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            >
              Income:
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div class="manifest-cell manifest-field half-width border-left">
              Direct costs:
            </div>
            <div class="manifest-cell manifest-field half-width border-right">
              Contribution:
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              OFFICE FOLLOW-UP
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            >
              Photos uploaded by driver: date ___/___/______
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            >
              Usage fees noted: NCC ____ NMTBC ____
            </div>
          </div>
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-field full-width border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              SYSTEM IMPROVEMENT NOTES
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-note full-width border-top border-left border-right"
            ></div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-subtitle shuttle-color full-width center-text border-top border-left border-right"
            >
              NOTES FOR SUBSEQUENT DRIVERS
            </div>
          </div>
  
          <div class="manifest-row">
            <div
              class="manifest-cell manifest-note full-width border-top border-left border-right border-bottom"
            ></div>
          </div>
        </div>
      </main>
    </body>
  </html>  
  `;
};

main(); // program is ran here
