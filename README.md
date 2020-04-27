# Pelius/Google Sheets Connector
A Node.js script based around the [Google Sheets Quickstart app](https://developers.google.com/sheets/api/quickstart/nodejs). This reads the addresses from a Google sheet, runs them through the Pelius geocoder, and writes the resulting coordinates back onto the sheet.

## To run
To run this script, you must have access to the Data Services Google account. Contact IT if you need help accessing this account.

Install the proper libraries with npm by running `npm install googleapis@39 --save`.

Run `node .` in your terminal; navigate to the provided URL. It will likely display a warning that "This app isn't verified." You can move past this by clicking **Advanced > Go to Sheets on a Map (Unsafe)**. When prompted, click **Accept** and copy the provided code. Paste it back into your terminal and hit **Enter** to generate your `token.json` and `credentials.json`.

Eventually, your `credentials.json` will be out of date. In that case, go to the Sheets on a Map - May 2020 project on Google Console and navigate to Credentials > OAuth Client > Download JSON. Replace the contents of `credentials.json` with the value in the new file.

Because you can only read in one sheet from a workbook at a time, you must specify which sheet you want to run the script on by editing line 71.

Sometimes Pelius gets jammed when running over addresses it has already searched for. To resolve, clear out the previously-calculated coordinates from your sheet and let the program do a fresh re-run of the entire sheet.