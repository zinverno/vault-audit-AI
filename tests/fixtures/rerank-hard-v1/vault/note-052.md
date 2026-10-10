# A tiny CSV example

The sample export has columns name, quantity and price, with commas between columns and a dot in decimal numbers. A standards-aware parser handles quoted names containing commas. Read the header before mapping fields to an object.

This example assumes one known format. Files from other spreadsheet locales can use a different delimiter and decimal convention, so copying these settings blindly may shift columns or misread amounts. Keep parsing and numeric conversion separate, and report malformed rows instead of guessing.
