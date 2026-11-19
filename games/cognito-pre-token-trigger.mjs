// AWS Lambda: merge the role claim into Cognito Pre-Token Generation V1_0.
// If the User Pool already has a trigger, merge this into that function,
// since Cognito permits only one Pre-Token Generation trigger per pool.
export const handler = async event => {
  const response = event.response || {};
  const overrides = response.claimsOverrideDetails || {};
  response.claimsOverrideDetails = {
    ...overrides,
    claimsToAddOrOverride: {
      ...(overrides.claimsToAddOrOverride || {}),
      role: 'authenticated'
    }
  };
  event.response = response;
  return event;
};
