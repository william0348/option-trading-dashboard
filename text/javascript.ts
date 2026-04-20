
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// SCRIPT VERSION: 2.0 - This version log helps confirm the correct script is deployed.
// AFTER MAKING CHANGES: Remember to go to Deploy > New deployment to publish the updates.

// Fix: Declare Google Apps Script globals to resolve TypeScript errors.
declare const SpreadsheetApp: any;
declare const ContentService: any;
declare const LockService: any;

// This Google Apps Script acts as a secure backend for the Option Trading Dashboard.
// It is written in pure JavaScript for direct deployment in the Google Apps Script editor.
// It exposes a web app endpoint that handles:
//  - GET requests to load all data from a Google Sheet.
//  - POST requests to save new data to the Google Sheet.

// --- SCRIPT CONFIGURATION ---
// IMPORTANT: Please verify this is the correct ID for your target Google Sheet.
var GOOGLE_SHEET_ID = '1Ty2tMdu_6UT0507vSo9eivU3w0mv3aK6diQTwWsZ70E';
// IMPORTANT: This sheet name must match what the script will read from and write to.
var RAW_DATA_SHEET_NAME = 'Data';
// --- END CONFIGURATION ---

/**
 * Creates a JSON response.
 * @param {object} payload The JavaScript object to be stringified and returned.
 * @returns {object} A ContentService TextOutput object configured for a JSON response.
 */
function createJsonResponse(payload) {
  var output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Handles HTTP GET requests to the web app (e.g., when "Load from Sheet" is clicked).
 * Reads all data from the specified Google Sheet, converts it to JSON, and returns it.
 * @param {object} e The event parameter for a GET request.
 * @returns {object} A ContentService TextOutput object with a JSON payload.
 */
function doGet(e) {
  try {
    console.log("--- Executing doGet (Version 2.0) ---");
    console.log("Attempting to access Sheet ID: " + GOOGLE_SHEET_ID);
    
    var spreadSheet = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
    if (!spreadSheet) {
      throw new Error("Could not open spreadsheet with ID: " + GOOGLE_SHEET_ID + ". Please check if the ID is correct and you have access.");
    }
    console.log("Successfully opened spreadsheet: " + spreadSheet.getName());

    var sheet = spreadSheet.getSheetByName(RAW_DATA_SHEET_NAME);
    if (!sheet) {
      console.log('Sheet "' + RAW_DATA_SHEET_NAME + '" not found. This is not an error. Returning empty array.');
      return createJsonResponse({ 'status': 'success', 'data': [] });
    }
    console.log("Found sheet: " + RAW_DATA_SHEET_NAME);

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    console.log("Retrieved data range with " + values.length + " rows and " + (values.length > 0 ? values[0].length : 0) + " columns.");
    
    if (values.length < 2) {
      console.log("Sheet has no data rows (total rows <= 1). Returning empty array.");
      return createJsonResponse({ 'status': 'success', 'data': [] });
    }
    
    var header = values.shift(); // Remove header row
    console.log("Header row identified: " + header.join(", "));

    var data = values.map(function(row) {
      var obj = {};
      header.forEach(function(key, index) {
        obj[key] = row[index] !== undefined && row[index] !== null ? row[index] : "";
      });
      return obj;
    });

    console.log('Successfully processed ' + data.length + ' rows. Preparing to send response.');
    
    console.log("--- doGet finished successfully (Version 2.0) ---");
    return createJsonResponse({ 'status': 'success', 'data': data });

  } catch (error) {
    var errorMessage = 'FATAL ERROR in doGet (Version 2.0): ' + (error.message || 'Unknown error') + ' | Stack: ' + (error.stack || 'No stack available');
    console.error(errorMessage);
    return createJsonResponse({ 'status': 'error', 'message': errorMessage });
  }
}


/**
 * Handles HTTP POST requests to the web app (e.g., when "Save Raw Data to Sheet" is clicked).
 * It uses a predefined header to ensure data consistency in the Google Sheet.
 * @param {object} e The event parameter for a POST request, containing the data payload.
 * @returns {object} A ContentService TextOutput object with a JSON payload.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  var SCRIPT_DEFINED_HEADER = ["Date", "Action", "Symbol", "Description", "Account", "Quantity", "Price", "Fees & Comm", "Amount"];

  console.log("--- Executing doPost (Version 2.0) ---");

  try {
    if (!e || !e.parameter || !e.parameter.payload) {
      var errorDetails = 'Request event object "e" did not contain the expected "payload" parameter. Raw event: ' + JSON.stringify(e);
      throw new Error("Invalid POST request. " + errorDetails);
    }
    
    var postData = JSON.parse(e.parameter.payload);

    if (!postData.header || !Array.isArray(postData.header) || !postData.rows || !Array.isArray(postData.rows)) {
      throw new Error("Invalid payload: 'header' or 'rows' keys are missing or invalid.");
    }
    
    if (postData.rows.length === 0) {
      return createJsonResponse({ 'status': 'success', 'message': 'No new rows to append.' });
    }

    var spreadSheet = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
    var sheet = spreadSheet.getSheetByName(RAW_DATA_SHEET_NAME);

    if (!sheet) {
      sheet = spreadSheet.insertSheet(RAW_DATA_SHEET_NAME);
      console.log('Sheet "' + RAW_DATA_SHEET_NAME + '" was not found. Created a new one.');
    }

    if (sheet.getLastRow() === 0) {
      console.log("Sheet is empty. Appending the script-defined header.");
      sheet.appendRow(SCRIPT_DEFINED_HEADER);
    }
    
    var incomingHeader = postData.header;
    var indexMap = SCRIPT_DEFINED_HEADER.map(function(canonicalHeader) {
        var index = incomingHeader.indexOf(canonicalHeader);
        if (index === -1) {
            throw new Error('Incoming data is missing a required column: "' + canonicalHeader + '"');
        }
        return index;
    });

    var reorderedRows = postData.rows.map(function(incomingRow) {
        return indexMap.map(function(originalIndex) {
            return incomingRow[originalIndex];
        });
    });
    
    var startRow = sheet.getLastRow() + 1;
    var numRows = reorderedRows.length;
    
    if (numRows > 0) {
        console.log('Attempting to write ' + numRows + ' rows to sheet "' + RAW_DATA_SHEET_NAME + '".');
        sheet.getRange(startRow, 1, numRows, SCRIPT_DEFINED_HEADER.length).setValues(reorderedRows);
        console.log('Successfully wrote ' + numRows + ' rows.');
    }

    return createJsonResponse({ 'status': 'success', 'message': numRows + ' row(s) appended successfully.' });

  } catch (error) {
    var errorMessage = 'Error in doPost (Version 2.0): ' + (error.message ? error.message + ' Stack: ' + error.stack : error.toString());
    console.error(errorMessage);
    return createJsonResponse({ 'status': 'error', 'message': errorMessage });

  } finally {
    lock.releaseLock();
  }
}
