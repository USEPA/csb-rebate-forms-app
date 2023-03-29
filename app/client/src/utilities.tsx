import { BapSamEntity } from "components/dashboard";

/**
 * Returns a user’s title and name when provided an email address and a SAM.gov
 * entity/record.
 */
export function getUserInfo(email: string, entity: BapSamEntity) {
  const samEmailFields = [
    "ELEC_BUS_POC_EMAIL__c",
    "ALT_ELEC_BUS_POC_EMAIL__c",
    "GOVT_BUS_POC_EMAIL__c",
    "ALT_GOVT_BUS_POC_EMAIL__c",
  ];

  let matchedEmailField;

  for (const [field, value] of Object.entries(entity)) {
    if (!samEmailFields.includes(field)) continue;
    // NOTE: take the first match only (the assumption is if a user is listed
    // as multiple POCs, their title and name will be the same for all POCs)
    if (
      typeof value === "string" &&
      value.toLowerCase() === email.toLowerCase()
    ) {
      matchedEmailField = field;
      break;
    }
  }

  const fieldPrefix = matchedEmailField?.split("_EMAIL__c").shift();

  return {
    title: entity[`${fieldPrefix}_TITLE__c` as keyof BapSamEntity] as string,
    name: entity[`${fieldPrefix}_NAME__c` as keyof BapSamEntity] as string,
  };
}
