import { IIssuer } from '~/models/schemas/issuer.schema'
import { UserVerificationStatus, KYCStatusType } from '~/constants/enum'

/**
 * Determine user verification status based on issuer data
 */
export const determineVerificationStatus = (issuer: IIssuer): UserVerificationStatus => {
  if (issuer.kycStatus.status === KYCStatusType.APPROVED) {
    return UserVerificationStatus.FullyVerified
  }
  if (issuer.isEmailVerified) {
    return UserVerificationStatus.EmailVerified
  }
  return UserVerificationStatus.Unverified
}
