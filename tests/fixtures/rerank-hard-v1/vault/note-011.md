# Recognizing scanned recipes on a laptop

Install the OCR engine and the required language packs ahead of time. Run recognition against local image files with networking disabled, then inspect uncertain words in the generated text. Images and extracted text stay on the laptop; no remote inference service is part of this workflow.

For old recipe cards, deskewing and contrast correction often matter more than changing the language model. Keep the original scan next to the corrected transcript. The first installation may require a download, so prepare the machine before taking it offline. Batch processing writes to a separate output directory and never overwrites the scans.
