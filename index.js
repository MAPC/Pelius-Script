const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const axios = require('axios');
const rateLimit = require('axios-rate-limit');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';


// Rate-limited axios, so we don't overwhelm Pelias or get rate-limited while working with Google APIs
const rlaxios = rateLimit(axios.create(), { maxRPS: 30 })

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), processSheets);
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

function shouldGeocode(sheet) {
  if (sheet.disableGeocoding != null && (sheet.disableGeocoding == "Y" || sheet.disableGeocoding == "Yes")) {
    return false;
  }
  return true;
}

function processSheets(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const dataSheet = 'Sheets to Geocode';
  return sheets.spreadsheets.values.get({
    spreadsheetId: '1cLwj7JzSo4RMk4mm7o62818aIC2lapqtbJJIWciCi_g',
    range: `${dataSheet}!A2:H`,
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const targetSheets = res.data.values.map(row => {
      return {
        id: row[0].split("/")[5],
        name: row[1],
        searchTermColumn: row[2],
        longColumn: row[3],
        latColumn: row[4],
        errorColumn: row[5],
        lastGeocodedAt: row[6],
        disableGeocoding: row[7]
      }
    });
    targetSheets.forEach(sheet => {
      if (shouldGeocode(sheet)) {
        readAddresses(auth, sheet);
      }
    });
  })
}

function readAddresses(auth, sheet) {
  const sheets = google.sheets({version: 'v4', auth});

  sheets.spreadsheets.values.get({
    spreadsheetId: sheet.id,
    range: `${sheet.name}!${sheet.searchTermColumn}2:${sheet.searchTermColumn}`,
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const addresses = res.data.values;
    let coordinates = [];
    addresses.forEach((row) => {
      // TODO: Update this code to use bounding boxes from whosonfirst to get better Pelias results
      /*
      const boundary = {
        rect: {
          min_lon: -70.467605,
          min_lat: 41.586336,
          max_lon: -70.25964,
          max_lat: 41.740088
        }
      }
      */
      // const full_url = `https://pelias.mapc.org/v1/search?text=${addresses[i]}&boundary.rect.min_lat=${boundary.rect.min_lat}&boundary.rect.min_lon=${boundary.rect.min_lon}&boundary.rect.max_lat=${boundary.rect.max_lat}&boundary.rect.max_lon=${boundary.rect.max_lon}`;
      const full_url = `https://pelias.mapc.org/v1/search?text=${row}`;
      coordinates.push(rlaxios.get(full_url)
        .then((result) => new Promise(resolve => {
          if (result.data.features.length > 0) {
            return resolve(result.data.features[0].geometry.coordinates);
          } else {
            return resolve(["Error", "Error"]);
          }
          }))
        .catch((error) => console.log(error))
      )
    });

    Promise.all(coordinates).then((res) => {
      res = res.map(x => x == null? [null, null] : x);
      const request = {
        spreadsheetId: sheet.id,
        range: `${sheet.name}!${sheet.longColumn}2:${sheet.latColumn}`,
        valueInputOption: 'RAW',
        resource: { values: res },
        auth: auth,
      };

      try {
        sheets.spreadsheets.values.update(request).then(response => {
          console.log("Updated sheet with geocoder results");
          const now = new Date();
          const timestampRequest = {
            spreadsheetId: '1cLwj7JzSo4RMk4mm7o62818aIC2lapqtbJJIWciCi_g',
            range: `Sheets to Geocode!G2:G`,
            valueInputOption: 'RAW',
            resource: { values: [[now.toISOString()]] },
            auth: auth,
          };
          sheets.spreadsheets.values.update(timestampRequest);
        }, reason => {
          console.error('error: ', reason.result.error.message);
        });
      } catch (err) {
        console.error(err);
      }
    })
  });
}
