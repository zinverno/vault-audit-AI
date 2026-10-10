# Remote transcription queue

A hosted speech service accepts uploaded recordings and returns transcripts asynchronously. Store the provider's job identifier, check its status and retrieve the result when complete. Uploading twice after a lost response can create two jobs unless the service provides an idempotency contract.

The audio leaves the machine in this workflow. Local playback and cached transcripts do not make recognition local. Retention, consent and access control must be addressed before using real recordings. A synthetic sample is adequate for checking the transport.
