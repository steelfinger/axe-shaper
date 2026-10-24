/** User-facing outcomes shared by creation and recovery. Permanent errors never invite retry. */
export function shareFailureMessage(code: string): string {
  switch (code) {
    case 'network': return 'The connection dropped. Try again to recover the same link.';
    case 'unavailable': return 'The sharing service did not respond. Trying again will not create a duplicate.';
    case 'quota-exceeded': return 'The sharing limit has been reached. Try again later, within the recovery window.';
    case 'attestation': case 'unauthorized': return 'This browser could not be verified. Allow reCAPTCHA and try again, or share the project file.';
    case 'operation-expired': return 'The recovery window has ended. A link may have been created, but this request will not be sent again. Contact support if you need help finding it.';
    case 'revoked': return 'This link has already been removed. It cannot be restored.';
    case 'too-large': case 'resource-limit': return 'This design is too large for link sharing. Share the project file instead.';
    case 'unsupported-schema': case 'unsupported-policy': case 'unsupported-share-format': return 'This saved request is not supported by the sharing service. Share the project file instead.';
    case 'conflict': return 'The saved request conflicts with an earlier upload. It will not be retried. Contact support if you need help finding the earlier link.';
    default: return 'The sharing service rejected this request. It will not be retried. Share the project file instead.';
  }
}
