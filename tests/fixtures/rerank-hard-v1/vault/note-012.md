# Hosted OCR for a shared archive

The archive team uploads scanned pages to a cloud OCR service and receives searchable text with confidence scores. A central queue makes it convenient to process large batches from several computers. Language detection and layout analysis are performed by the remote provider.

Local preprocessing can crop borders before upload, but the page contents still leave the computer. The retention policy and permission to transmit the material must be decided beforehand. This is not an offline workflow. Failed jobs keep their provider identifiers so an operator can inspect their status instead of resubmitting a whole batch.
