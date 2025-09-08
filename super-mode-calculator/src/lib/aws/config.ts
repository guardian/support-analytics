import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { RuntimeConfigAwsCredentialIdentityProvider } from '@aws-sdk/types';

const stage = process.env.STAGE ?? 'PROD';
const isDev = stage === 'DEV';

export const region = 'eu-west-1';
export const credentials = (): RuntimeConfigAwsCredentialIdentityProvider => {
	return isDev
		? fromIni({
				profile: process.env.AWS_PROFILE ?? 'membership',
		  })
		: fromNodeProviderChain();
};
