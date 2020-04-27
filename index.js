const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const axios = require('axios');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), readAddresses);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function readAddresses(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  // Options: "Testing Facilities", "Shelters"
  const sheetToUpdate = 'Testing Facilities'
  sheets.spreadsheets.values.get({
    spreadsheetId: '1RYc2Y0wgjzt4liubLk_l631zUeAIz9ilCFHYNsthimU',
    range: `${sheetToUpdate}!A2:E`,
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const rows = res.data.values;
    let addresses = [];
    if (rows.length) {
      rows.map((row) => {
        addresses.push(row[2])
      });
    } else {
      console.log('No data found.');
    }
    let coordinates = [];
    addresses.forEach((row) => {
      coordinates.push(axios.get(`http://pelias.mapc.org/v1/search?text=${row}`)
        .then((result) => new Promise(resolve => resolve(result.data.features[0].geometry.coordinates)))
        .catch((error) => console.log(error))
      )
    });
    Promise.all(coordinates).then((res) => {
      const request = {
        spreadsheetId: '1RYc2Y0wgjzt4liubLk_l631zUeAIz9ilCFHYNsthimU',
        range: `${sheetToUpdate}!E2:F`,
        valueInputOption: 'RAW',
        resource: { values: res },
        auth: auth,
      };

      try {
        (sheets.spreadsheets.values.update(request)).data;
        console.log("Success");
      } catch (err) {
        console.error(err);
      }
    })
  });
}
