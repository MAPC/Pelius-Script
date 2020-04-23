# Pelius/Google Sheets Connector
A Node.js script based around the [Google Sheets Quickstart app](https://developers.google.com/sheets/api/quickstart/nodejs). This reads the addresses from a Google sheet, runs them through the Pelius geocoder, and writes the resulting coordinates back onto the sheet.

## To run
To run this script, you must have access to the Data Services Google account. Contact IT if you need help accessing this account.

Install the proper libraries with npm by running `npm install googleapis@39 --save`.

Run `node .` in your terminal; navigate to the provided URL. It will likely display a warning that "This app isn't verified." You can move past this by clicking **Advanced > Go to Sheets on a Map (Unsafe)**. When prompted, click **Accept** and copy the provided code. Paste it back into your terminal and hit **Enter** to generate your `token.json` and `credentials.json`. You only need to do this once.

Because you can only read in one sheet from a workbook at a time, you must specify which sheet you want to run the script on by editing line 71.