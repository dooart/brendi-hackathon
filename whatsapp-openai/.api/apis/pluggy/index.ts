import type * as types from './types';
import type { ConfigOptions, FetchResponse } from 'api/dist/core'
import Oas from 'oas';
import APICore from 'api/dist/core';
import definition from './openapi.json';

class SDK {
  spec: Oas;
  core: APICore;

  constructor() {
    this.spec = Oas.init(definition);
    this.core = new APICore(this.spec, 'pluggy/1.0.0 (api/6.1.3)');
  }

  /**
   * Optionally configure various options that the SDK allows.
   *
   * @param config Object of supported SDK options and toggles.
   * @param config.timeout Override the default `fetch` request timeout of 30 seconds. This number
   * should be represented in milliseconds.
   */
  config(config: ConfigOptions) {
    this.core.setConfig(config);
  }

  /**
   * If the API you're using requires authentication you can supply the required credentials
   * through this method and the library will magically determine how they should be used
   * within your API request.
   *
   * With the exception of OpenID and MutualTLS, it supports all forms of authentication
   * supported by the OpenAPI specification.
   *
   * @example <caption>HTTP Basic auth</caption>
   * sdk.auth('username', 'password');
   *
   * @example <caption>Bearer tokens (HTTP or OAuth 2)</caption>
   * sdk.auth('myBearerToken');
   *
   * @example <caption>API Keys</caption>
   * sdk.auth('myApiKey');
   *
   * @see {@link https://spec.openapis.org/oas/v3.0.3#fixed-fields-22}
   * @see {@link https://spec.openapis.org/oas/v3.1.0#fixed-fields-22}
   * @param values Your auth credentials for the API; can specify up to two strings or numbers.
   */
  auth(...values: string[] | number[]) {
    this.core.setAuth(...values);
    return this;
  }

  /**
   * If the API you're using offers alternate server URLs, and server variables, you can tell
   * the SDK which one to use with this method. To use it you can supply either one of the
   * server URLs that are contained within the OpenAPI definition (along with any server
   * variables), or you can pass it a fully qualified URL to use (that may or may not exist
   * within the OpenAPI definition).
   *
   * @example <caption>Server URL with server variables</caption>
   * sdk.server('https://{region}.api.example.com/{basePath}', {
   *   name: 'eu',
   *   basePath: 'v14',
   * });
   *
   * @example <caption>Fully qualified server URL</caption>
   * sdk.server('https://eu.api.example.com/v14');
   *
   * @param url Server URL
   * @param variables An object of variables to replace into the server URL.
   */
  server(url: string, variables = {}) {
    this.core.setServer(url, variables);
  }

  /**
   * Validate clientId and clientSecret and return an API Key
   *
   * @summary Create API Key
   * @throws FetchError<401, types.AuthCreateResponse401> Invalid credentials
   * @throws FetchError<500, types.AuthCreateResponse500> Server Internal Error
   */
  authCreate(body: types.AuthCreateBodyParam): Promise<FetchResponse<200, types.AuthCreateResponse200>> {
    return this.core.fetch('/auth', 'post', body);
  }

  /**
   * Creates a connect token
   *
   * @summary Create Connect Token
   * @throws FetchError<403, types.ConnectTokenCreateResponse403> Unauthenticated
   * @throws FetchError<404, types.ConnectTokenCreateResponse404> Related itemId to update not found
   * @throws FetchError<500, types.ConnectTokenCreateResponse500> Unexpected error
   */
  connectTokenCreate(body?: types.ConnectTokenCreateBodyParam): Promise<FetchResponse<200, types.ConnectTokenCreateResponse200>> {
    return this.core.fetch('/connect_token', 'post', body);
  }

  /**
   * This endpoint retrieves all available connectors.
   *
   * @summary List
   */
  connectorsList(metadata?: types.ConnectorsListMetadataParam): Promise<FetchResponse<200, types.ConnectorsListResponse200>> {
    return this.core.fetch('/connectors', 'get', metadata);
  }

  /**
   * This endpoint retrieves a specific connector.
   *
   * @summary Retrieve
   * @throws FetchError<404, types.ConnectorRetrieveResponse404> Connector not found
   */
  connectorRetrieve(metadata: types.ConnectorRetrieveMetadataParam): Promise<FetchResponse<200, types.ConnectorRetrieveResponse200>> {
    return this.core.fetch('/connectors/{id}', 'get', metadata);
  }

  /**
   * Validates a connector parameters usign the connector validation
   *
   * @summary Validate
   */
  connectorsValidate(body: types.ConnectorsValidateBodyParam, metadata: types.ConnectorsValidateMetadataParam): Promise<FetchResponse<200, types.ConnectorsValidateResponse200>> {
    return this.core.fetch('/connectors/{id}/validate', 'post', body, metadata);
  }

  /**
   * Creates a item and syncs all the products with the financial institution, using as
   * credentials the sent parameters.
   *
   * @summary Create
   * @throws FetchError<400, types.ItemsCreateResponse400> Invalid parameters
   * @throws FetchError<409, types.ItemsCreateResponse409> There is a conflict creating an item
   * @throws FetchError<500, types.ItemsCreateResponse500> Unexpected error
   */
  itemsCreate(body: types.ItemsCreateBodyParam): Promise<FetchResponse<200, types.ItemsCreateResponse200>> {
    return this.core.fetch('/items', 'post', body);
  }

  /**
   * Recovers the item resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.ItemsRetrieveResponse404> Item not found
   * @throws FetchError<500, types.ItemsRetrieveResponse500> Server Internal Error
   */
  itemsRetrieve(metadata: types.ItemsRetrieveMetadataParam): Promise<FetchResponse<200, types.ItemsRetrieveResponse200>> {
    return this.core.fetch('/items/{id}', 'get', metadata);
  }

  /**
   * Triggers new syncronization for the Item, optionally updating the stored credentials.
   *
   * @summary Update
   * @throws FetchError<400, types.ItemsUpdateResponse400> Invalid parameters
   * @throws FetchError<404, types.ItemsUpdateResponse404> Item not found
   * @throws FetchError<409, types.ItemsUpdateResponse409> There is a conflict updating the item
   * @throws FetchError<500, types.ItemsUpdateResponse500> Server Internal Error
   */
  itemsUpdate(body: types.ItemsUpdateBodyParam, metadata: types.ItemsUpdateMetadataParam): Promise<FetchResponse<200, types.ItemsUpdateResponse200>>;
  itemsUpdate(metadata: types.ItemsUpdateMetadataParam): Promise<FetchResponse<200, types.ItemsUpdateResponse200>>;
  itemsUpdate(body?: types.ItemsUpdateBodyParam | types.ItemsUpdateMetadataParam, metadata?: types.ItemsUpdateMetadataParam): Promise<FetchResponse<200, types.ItemsUpdateResponse200>> {
    return this.core.fetch('/items/{id}', 'patch', body, metadata);
  }

  /**
   * Delete the item by its primary identifier
   *
   * @summary Delete
   * @throws FetchError<404, types.ItemsDeleteResponse404> Item not found
   * @throws FetchError<500, types.ItemsDeleteResponse500> Server Internal Error
   */
  itemsDelete(metadata: types.ItemsDeleteMetadataParam): Promise<FetchResponse<200, types.ItemsDeleteResponse200>> {
    return this.core.fetch('/items/{id}', 'delete', metadata);
  }

  /**
   * When item is Waiting User Input, this method allows to submit multi-factor
   * authentication value
   *
   * @summary Send MFA
   * @throws FetchError<404, types.ItemsSendMfaResponse404> Item not found
   * @throws FetchError<500, types.ItemsSendMfaResponse500> Server Internal Error
   */
  itemsSendMfa(body: types.ItemsSendMfaBodyParam, metadata: types.ItemsSendMfaMetadataParam): Promise<FetchResponse<200, types.ItemsSendMfaResponse200>> {
    return this.core.fetch('/items/{id}/mfa', 'post', body, metadata);
  }

  /**
   * When client disables auto sync, the item will not be updated automatically anymore,
   * until the client force an item update.
   *
   * @summary Disable item auto sync
   * @throws FetchError<404, types.ItemsDisableAutosyncResponse404> Item not found
   * @throws FetchError<500, types.ItemsDisableAutosyncResponse500> Server Internal Error
   */
  itemsDisableAutosync(metadata: types.ItemsDisableAutosyncMetadataParam): Promise<FetchResponse<200, types.ItemsDisableAutosyncResponse200>> {
    return this.core.fetch('/items/{id}/disable-auto-sync', 'patch', metadata);
  }

  /**
   * Recovers all consents given to the item provided
   *
   * @summary List
   * @throws FetchError<400, types.ConsentsListResponse400> Missing parameter
   * @throws FetchError<500, types.ConsentsListResponse500> Server Internal Error
   */
  consentsList(metadata: types.ConsentsListMetadataParam): Promise<FetchResponse<200, types.ConsentsListResponse200>> {
    return this.core.fetch('/consents', 'get', metadata);
  }

  /**
   * Recovers the consent resource by it's id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.ConsentRetrieveResponse404> Consent not found
   * @throws FetchError<500, types.ConsentRetrieveResponse500> Server Internal Error
   */
  consentRetrieve(metadata: types.ConsentRetrieveMetadataParam): Promise<FetchResponse<200, types.ConsentRetrieveResponse200>> {
    return this.core.fetch('/consents/{id}', 'get', metadata);
  }

  /**
   * Recovers all accounts collected for the item provided
   *
   * @summary List
   */
  accountsList(metadata: types.AccountsListMetadataParam): Promise<FetchResponse<200, types.AccountsListResponse200>> {
    return this.core.fetch('/accounts', 'get', metadata);
  }

  /**
   * Recovers the account resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.AccountsRetrieveResponse404> Account not found
   * @throws FetchError<500, types.AccountsRetrieveResponse500> Server Internal Error
   */
  accountsRetrieve(metadata: types.AccountsRetrieveMetadataParam): Promise<FetchResponse<200, types.AccountsRetrieveResponse200>> {
    return this.core.fetch('/accounts/{id}', 'get', metadata);
  }

  /**
   * Recovers all transactions collected for the acount provided
   *
   * @summary List
   * @throws FetchError<400, types.TransactionsListResponse400> Missing parameter
   * @throws FetchError<500, types.TransactionsListResponse500> Server Internal Error
   */
  transactionsList(metadata: types.TransactionsListMetadataParam): Promise<FetchResponse<200, types.TransactionsListResponse200>> {
    return this.core.fetch('/transactions', 'get', metadata);
  }

  /**
   * Recovers the transaction resource by it's id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.TransactionsRetrieveResponse404> Transaction not found
   * @throws FetchError<500, types.TransactionsRetrieveResponse500> Server Internal Error
   */
  transactionsRetrieve(metadata: types.TransactionsRetrieveMetadataParam): Promise<FetchResponse<200, types.TransactionsRetrieveResponse200>> {
    return this.core.fetch('/transactions/{id}', 'get', metadata);
  }

  /**
   * Update the transaction's category by it's id
   *
   * @summary Update
   * @throws FetchError<400, types.TransactionsUpdateResponse400> Missing parameter
   * @throws FetchError<404, types.TransactionsUpdateResponse404> Transaction not found
   * @throws FetchError<500, types.TransactionsUpdateResponse500> Server Internal Error
   */
  transactionsUpdate(body: types.TransactionsUpdateBodyParam, metadata: types.TransactionsUpdateMetadataParam): Promise<FetchResponse<200, types.TransactionsUpdateResponse200>> {
    return this.core.fetch('/transactions/{id}', 'patch', body, metadata);
  }

  /**
   * Recovers all investments collected for the item provided
   *
   * @summary List
   */
  investmentsList(metadata: types.InvestmentsListMetadataParam): Promise<FetchResponse<200, types.InvestmentsListResponse200>> {
    return this.core.fetch('/investments', 'get', metadata);
  }

  /**
   * Recovers the investment resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.InvestmentsRetrieveResponse404> Investment not found
   */
  investmentsRetrieve(metadata: types.InvestmentsRetrieveMetadataParam): Promise<FetchResponse<200, types.InvestmentsRetrieveResponse200>> {
    return this.core.fetch('/investments/{id}', 'get', metadata);
  }

  /**
   * Recovers all investment transactions for the investment provided
   *
   * @summary List investment transactions
   * @throws FetchError<500, types.InvestmentTransactionsListResponse500> Server Internal Error
   */
  investmentTransactionsList(metadata: types.InvestmentTransactionsListMetadataParam): Promise<FetchResponse<200, types.InvestmentTransactionsListResponse200>> {
    return this.core.fetch('/investments/{id}/transactions', 'get', metadata);
  }

  /**
   * Recovers identity of an item if available
   *
   * @summary Find by item
   * @throws FetchError<400, types.IdentityFindByItemResponse400> Invalid parameters
   * @throws FetchError<404, types.IdentityFindByItemResponse404> Identity not found
   * @throws FetchError<500, types.IdentityFindByItemResponse500> Server Internal Error
   */
  identityFindByItem(metadata: types.IdentityFindByItemMetadataParam): Promise<FetchResponse<200, types.IdentityFindByItemResponse200>> {
    return this.core.fetch('/identity', 'get', metadata);
  }

  /**
   * Recovers the identity resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<400, types.IdentityRetrieveResponse400> Invalid parameters
   * @throws FetchError<404, types.IdentityRetrieveResponse404> Identity not found
   * @throws FetchError<500, types.IdentityRetrieveResponse500> Server Internal Error
   */
  identityRetrieve(metadata: types.IdentityRetrieveMetadataParam): Promise<FetchResponse<200, types.IdentityRetrieveResponse200>> {
    return this.core.fetch('/identity/{id}', 'get', metadata);
  }

  /**
   * Retrieves all Webhooks associated with your application
   *
   * @summary List
   * @throws FetchError<500, types.WebhooksListResponse500> Unexpected error
   */
  webhooksList(): Promise<FetchResponse<200, types.WebhooksListResponse200>> {
    return this.core.fetch('/webhooks', 'get');
  }

  /**
   * Creates a webhook attached to the specific event and provides the notification url
   *
   * @summary Create
   * @throws FetchError<400, types.WebhooksCreateResponse400> Invalid parameters
   * @throws FetchError<500, types.WebhooksCreateResponse500> Unexpected error
   */
  webhooksCreate(body: types.WebhooksCreateBodyParam): Promise<FetchResponse<201, types.WebhooksCreateResponse201>> {
    return this.core.fetch('/webhooks', 'post', body);
  }

  /**
   * Retrieves a specific webhook
   *
   * @summary Retrieve
   * @throws FetchError<404, types.WebhooksRetrieveResponse404> Webhook not found
   * @throws FetchError<500, types.WebhooksRetrieveResponse500> Unexpected error
   */
  webhooksRetrieve(metadata: types.WebhooksRetrieveMetadataParam): Promise<FetchResponse<200, types.WebhooksRetrieveResponse200>> {
    return this.core.fetch('/webhooks/{id}', 'get', metadata);
  }

  /**
   * Updates a webhook event and/or url listener. Once updated all events that are triggered
   * will replicate the updated logic
   *
   * @summary Update
   * @throws FetchError<400, types.WebhooksUpdateResponse400> Invalid parameters
   * @throws FetchError<404, types.WebhooksUpdateResponse404> Webhook not found
   * @throws FetchError<500, types.WebhooksUpdateResponse500> Unexpected error
   */
  webhooksUpdate(body: types.WebhooksUpdateBodyParam, metadata: types.WebhooksUpdateMetadataParam): Promise<FetchResponse<200, types.WebhooksUpdateResponse200>> {
    return this.core.fetch('/webhooks/{id}', 'patch', body, metadata);
  }

  /**
   * Deletes a webhook listener by its id
   *
   * @summary Delete
   * @throws FetchError<404, types.WebhooksDeleteResponse404> Webhook not found
   * @throws FetchError<500, types.WebhooksDeleteResponse500> Unexpected error
   */
  webhooksDelete(metadata: types.WebhooksDeleteMetadataParam): Promise<FetchResponse<200, types.WebhooksDeleteResponse200>> {
    return this.core.fetch('/webhooks/{id}', 'delete', metadata);
  }

  /**
   * Recovers all categories active from the data categorization.
   * Can be filtered by the parentId of the category.
   *
   * @summary List
   */
  categoriesList(metadata?: types.CategoriesListMetadataParam): Promise<FetchResponse<200, types.CategoriesListResponse200>> {
    return this.core.fetch('/categories', 'get', metadata);
  }

  /**
   * Recovers the category resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.CategoriesRetrieveResponse404> Category not found
   */
  categoriesRetrieve(metadata: types.CategoriesRetrieveMetadataParam): Promise<FetchResponse<200, types.CategoriesRetrieveResponse200>> {
    return this.core.fetch('/categories/{id}', 'get', metadata);
  }

  /**
   * Recovers category rules
   *
   * @summary List Category Rules
   */
  clientCategoryRulesList(): Promise<FetchResponse<200, types.ClientCategoryRulesListResponse200>> {
    return this.core.fetch('/categories/rules', 'get');
  }

  /**
   * Create a single category rule
   *
   * @summary Create Category Rule
   * @throws FetchError<400, types.ClientCategoryRulesCreateResponse400> Invalid description
   * @throws FetchError<404, types.ClientCategoryRulesCreateResponse404> Category not found
   */
  clientCategoryRulesCreate(body: types.ClientCategoryRulesCreateBodyParam): Promise<FetchResponse<200, types.ClientCategoryRulesCreateResponse200>> {
    return this.core.fetch('/categories/rules', 'post', body);
  }

  /**
   * Recovers all loans collected for the item provided
   *
   * @summary List
   */
  loansList(metadata: types.LoansListMetadataParam): Promise<FetchResponse<200, types.LoansListResponse200>> {
    return this.core.fetch('/loans', 'get', metadata);
  }

  /**
   * Recovers the loan resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.LoansRetrieveResponse404> Loan not found
   */
  loansRetrieve(metadata: types.LoansRetrieveMetadataParam): Promise<FetchResponse<200, types.LoansRetrieveResponse200>> {
    return this.core.fetch('/loans/{id}', 'get', metadata);
  }

  /**
   * Recovers all credit card bills collected for the account provided
   *
   * @summary List
   */
  billsList(metadata: types.BillsListMetadataParam): Promise<FetchResponse<200, types.BillsListResponse200>> {
    return this.core.fetch('/bills', 'get', metadata);
  }

  /**
   * Recovers the bill resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.BillsRetrieveResponse404> Bill not found
   */
  billsRetrieve(metadata: types.BillsRetrieveMetadataParam): Promise<FetchResponse<200, types.BillsRetrieveResponse200>> {
    return this.core.fetch('/bills/{id}', 'get', metadata);
  }

  /**
   * Recovers all created payment customers
   *
   * @summary List
   */
  paymentCustomersList(metadata?: types.PaymentCustomersListMetadataParam): Promise<FetchResponse<200, types.PaymentCustomersListResponse200>> {
    return this.core.fetch('/payments/customers', 'get', metadata);
  }

  /**
   * Create
   *
   * @throws FetchError<400, types.PaymentCustomerCreateResponse400> Payment Customer its Invalid
   */
  paymentCustomerCreate(body: types.PaymentCustomerCreateBodyParam): Promise<FetchResponse<200, types.PaymentCustomerCreateResponse200>> {
    return this.core.fetch('/payments/customers', 'post', body);
  }

  /**
   * Recovers the payment customer resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.PaymentCustomerRetrieveResponse404> Payment Customer not found
   */
  paymentCustomerRetrieve(metadata: types.PaymentCustomerRetrieveMetadataParam): Promise<FetchResponse<200, types.PaymentCustomerRetrieveResponse200>> {
    return this.core.fetch('/payments/customers/{id}', 'get', metadata);
  }

  /**
   * Deletes the payment customer resource by its id
   *
   * @summary Delete
   * @throws FetchError<404, types.PaymentCustomerDeleteResponse404> Payment customer not found
   */
  paymentCustomerDelete(metadata: types.PaymentCustomerDeleteMetadataParam): Promise<FetchResponse<number, unknown>> {
    return this.core.fetch('/payments/customers/{id}', 'delete', metadata);
  }

  /**
   * Updates the payment customer resource
   *
   * @summary Update
   */
  paymentCustomerUpdate(body: types.PaymentCustomerUpdateBodyParam, metadata: types.PaymentCustomerUpdateMetadataParam): Promise<FetchResponse<200, types.PaymentCustomerUpdateResponse200>> {
    return this.core.fetch('/payments/customers/{id}', 'patch', body, metadata);
  }

  /**
   * Recovers all created payment recipients
   *
   * @summary List
   */
  paymentRecipientsList(metadata?: types.PaymentRecipientsListMetadataParam): Promise<FetchResponse<200, types.PaymentRecipientsListResponse200>> {
    return this.core.fetch('/payments/recipients', 'get', metadata);
  }

  /**
   * Creates the payment recipient resource
   *
   * @summary Create
   * @throws FetchError<400, types.PaymentRecipientCreateResponse400> Payment Recipient its Invalid
   */
  paymentRecipientCreate(body: types.PaymentRecipientCreateBodyParam): Promise<FetchResponse<200, types.PaymentRecipientCreateResponse200>> {
    return this.core.fetch('/payments/recipients', 'post', body);
  }

  /**
   * Recovers the payment recipient resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.PaymentRecipientRetrieveResponse404> Payment Recipient not found
   */
  paymentRecipientRetrieve(metadata: types.PaymentRecipientRetrieveMetadataParam): Promise<FetchResponse<200, types.PaymentRecipientRetrieveResponse200>> {
    return this.core.fetch('/payments/recipients/{id}', 'get', metadata);
  }

  /**
   * Updates the payment recipient resource
   *
   * @summary Update
   */
  paymentRecipientUpdate(body: types.PaymentRecipientUpdateBodyParam, metadata: types.PaymentRecipientUpdateMetadataParam): Promise<FetchResponse<200, types.PaymentRecipientUpdateResponse200>> {
    return this.core.fetch('/payments/recipients/{id}', 'patch', body, metadata);
  }

  /**
   * Deletes the payment recipient resource by its id
   *
   * @summary Delete
   * @throws FetchError<404, types.PaymentRecipientDeleteResponse404> Payment recipient not found
   */
  paymentRecipientDelete(metadata: types.PaymentRecipientDeleteMetadataParam): Promise<FetchResponse<number, unknown>> {
    return this.core.fetch('/payments/recipients/{id}', 'delete', metadata);
  }

  /**
   * Recovers all created payment institutions
   *
   * @summary List Institutions
   */
  paymentRecipientsInstitutionList(metadata?: types.PaymentRecipientsInstitutionListMetadataParam): Promise<FetchResponse<200, types.PaymentRecipientsInstitutionListResponse200>> {
    return this.core.fetch('/payments/recipients/institutions', 'get', metadata);
  }

  /**
   * Recovers the payment institution resource by its id
   *
   * @summary Retrieve Institution
   * @throws FetchError<404, types.PaymentRecipientInstitutionsRetrieveResponse404> Payment Institution not found
   */
  paymentRecipientInstitutionsRetrieve(metadata: types.PaymentRecipientInstitutionsRetrieveMetadataParam): Promise<FetchResponse<200, types.PaymentRecipientInstitutionsRetrieveResponse200>> {
    return this.core.fetch('/payments/recipients/institutions/{id}', 'get', metadata);
  }

  /**
   * Recovers all created payment requests
   *
   * @summary List
   */
  paymentRequestsList(): Promise<FetchResponse<200, types.PaymentRequestsListResponse200>> {
    return this.core.fetch('/payments/requests', 'get');
  }

  /**
   * Creates the payment request resource
   *
   * @summary Create
   */
  paymentRequestCreate(body: types.PaymentRequestCreateBodyParam): Promise<FetchResponse<200, types.PaymentRequestCreateResponse200>> {
    return this.core.fetch('/payments/requests', 'post', body);
  }

  /**
   * Creates the PIX QR payment request resource
   *
   * @summary Create PIX QR payment request
   */
  paymentRequestCreatePixQr(body: types.PaymentRequestCreatePixQrBodyParam): Promise<FetchResponse<200, types.PaymentRequestCreatePixQrResponse200>> {
    return this.core.fetch('/payments/requests/pix-qr', 'post', body);
  }

  /**
   * Recovers the payment request resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.PaymentRequestRetrieveResponse404> Payment Request not found
   */
  paymentRequestRetrieve(metadata: types.PaymentRequestRetrieveMetadataParam): Promise<FetchResponse<200, types.PaymentRequestRetrieveResponse200>> {
    return this.core.fetch('/payments/requests/{id}', 'get', metadata);
  }

  /**
   * Deletes the payment request resource by its id
   *
   * @summary Delete
   * @throws FetchError<404, types.PaymentRequestDeleteResponse404> Payment Request not found
   */
  paymentRequestDelete(metadata: types.PaymentRequestDeleteMetadataParam): Promise<FetchResponse<number, unknown>> {
    return this.core.fetch('/payments/requests/{id}', 'delete', metadata);
  }

  /**
   * Updates the payment request resource
   *
   * @summary Update
   */
  paymentRequestUpdate(body: types.PaymentRequestUpdateBodyParam, metadata: types.PaymentRequestUpdateMetadataParam): Promise<FetchResponse<200, types.PaymentRequestUpdateResponse200>> {
    return this.core.fetch('/payments/requests/{id}', 'patch', body, metadata);
  }

  /**
   * Recovers all scheduled payments from a payment request
   *
   * @summary List Schedules
   */
  paymentSchedulesList(metadata: types.PaymentSchedulesListMetadataParam): Promise<FetchResponse<200, types.PaymentSchedulesListResponse200>> {
    return this.core.fetch('/payments/requests/{id}/schedules', 'get', metadata);
  }

  /**
   * Cancel Payment Schedule Authorization
   *
   */
  paymentSchedulesCancel(metadata: types.PaymentSchedulesCancelMetadataParam): Promise<FetchResponse<number, unknown>> {
    return this.core.fetch('/payments/requests/{id}/schedules/cancel', 'post', metadata);
  }

  /**
   * Cancel Payment Schedule
   *
   */
  paymentSchedulesCancelSpecific(metadata: types.PaymentSchedulesCancelSpecificMetadataParam): Promise<FetchResponse<number, unknown>> {
    return this.core.fetch('/payments/requests/{id}/schedules/{scheduleId}/cancel', 'post', metadata);
  }

  /**
   * Creates the payment intent resource
   *
   * @summary Create
   */
  paymentIntentCreate(body: types.PaymentIntentCreateBodyParam): Promise<FetchResponse<200, types.PaymentIntentCreateResponse200>> {
    return this.core.fetch('/payments/intents', 'post', body);
  }

  /**
   * Recovers all created payment intents for the payment request provided
   *
   * @summary List
   */
  paymentIntentsList(metadata: types.PaymentIntentsListMetadataParam): Promise<FetchResponse<200, types.PaymentIntentsListResponse200>> {
    return this.core.fetch('/payments/intents', 'get', metadata);
  }

  /**
   * Recovers the payment intent resource by its id
   *
   * @summary Retrieve
   * @throws FetchError<404, types.PaymentIntentRetrieveResponse404> Payment Intent not found
   */
  paymentIntentRetrieve(metadata: types.PaymentIntentRetrieveMetadataParam): Promise<FetchResponse<200, types.PaymentIntentRetrieveResponse200>> {
    return this.core.fetch('/payments/intents/{id}', 'get', metadata);
  }

  /**
   * Recovers all created preauthorizations
   *
   * @summary List preauthorizations
   */
  smartTranfersPreauthorizationsList(metadata?: types.SmartTranfersPreauthorizationsListMetadataParam): Promise<FetchResponse<200, types.SmartTranfersPreauthorizationsListResponse200>> {
    return this.core.fetch('/smart-transfers/preauthorizations', 'get', metadata);
  }

  /**
   * Creates the smart transfer preauthorization resource
   *
   * @summary Create preauthorization
   * @throws FetchError<400, types.SmartTransferPreauthorizationCreateResponse400> Preauthorization is Invalid
   */
  smartTransferPreauthorizationCreate(body: types.SmartTransferPreauthorizationCreateBodyParam): Promise<FetchResponse<200, types.SmartTransferPreauthorizationCreateResponse200>> {
    return this.core.fetch('/smart-transfers/preauthorizations', 'post', body);
  }

  /**
   * Recovers the smart transfer preauthorization resource by its id
   *
   * @summary Retrieve preauthorization
   * @throws FetchError<404, types.SmartTransferPreauthorizationRetrieveResponse404> Smart Transfer Preauthorization not found
   */
  smartTransferPreauthorizationRetrieve(metadata: types.SmartTransferPreauthorizationRetrieveMetadataParam): Promise<FetchResponse<200, types.SmartTransferPreauthorizationRetrieveResponse200>> {
    return this.core.fetch('/smart-transfers/preauthorizations/{id}', 'get', metadata);
  }

  /**
   * Creates the smart transfer payment resource
   *
   * @summary Create payment
   * @throws FetchError<400, types.SmartTransferPaymentCreateResponse400> Payment is Invalid
   */
  smartTransferPaymentCreate(body: types.SmartTransferPaymentCreateBodyParam): Promise<FetchResponse<200, types.SmartTransferPaymentCreateResponse200>> {
    return this.core.fetch('/smart-transfers/payments', 'post', body);
  }

  /**
   * Recovers the smart transfer payment resource by its id
   *
   * @summary Retrieve payment
   * @throws FetchError<404, types.SmartTransferPaymentretrieveResponse404> Smart Transfer Payment not found
   */
  smartTransferPaymentretrieve(metadata: types.SmartTransferPaymentretrieveMetadataParam): Promise<FetchResponse<200, types.SmartTransferPaymentretrieveResponse200>> {
    return this.core.fetch('/smart-transfers/payments/{id}', 'get', metadata);
  }

  /**
   * Connect boleto credentials
   *
   * @throws FetchError<400, types.BoletoConnectionCreateResponse400> Incorrect credentials
   */
  boletoConnectionCreate(body: types.BoletoConnectionCreateBodyParam): Promise<FetchResponse<200, types.BoletoConnectionCreateResponse200>> {
    return this.core.fetch('/boleto-connections', 'post', body);
  }

  /**
   * Create boleto connection from Item
   *
   */
  boletoConnectionCreateFromItem(body: types.BoletoConnectionCreateFromItemBodyParam): Promise<FetchResponse<200, types.BoletoConnectionCreateFromItemResponse200>> {
    return this.core.fetch('/boleto-connections/from-item', 'post', body);
  }

  /**
   * Issue Boleto
   *
   */
  boletoCreate(body: types.BoletoCreateBodyParam): Promise<FetchResponse<200, types.BoletoCreateResponse200>> {
    return this.core.fetch('/boletos', 'post', body);
  }

  /**
   * Cancel Boleto
   *
   */
  boletoCancel(metadata: types.BoletoCancelMetadataParam): Promise<FetchResponse<200, types.BoletoCancelResponse200>> {
    return this.core.fetch('/boletos/{id}/cancel', 'post', metadata);
  }

  /**
   * Get Boleto
   *
   */
  boletoGet(metadata: types.BoletoGetMetadataParam): Promise<FetchResponse<200, types.BoletoGetResponse200>> {
    return this.core.fetch('/boletos/{id}', 'get', metadata);
  }
}

const createSDK = (() => { return new SDK(); })()
;

export default createSDK;

export type { AccountsListMetadataParam, AccountsListResponse200, AccountsRetrieveMetadataParam, AccountsRetrieveResponse200, AccountsRetrieveResponse404, AccountsRetrieveResponse500, AuthCreateBodyParam, AuthCreateResponse200, AuthCreateResponse401, AuthCreateResponse500, BillsListMetadataParam, BillsListResponse200, BillsRetrieveMetadataParam, BillsRetrieveResponse200, BillsRetrieveResponse404, BoletoCancelMetadataParam, BoletoCancelResponse200, BoletoConnectionCreateBodyParam, BoletoConnectionCreateFromItemBodyParam, BoletoConnectionCreateFromItemResponse200, BoletoConnectionCreateResponse200, BoletoConnectionCreateResponse400, BoletoCreateBodyParam, BoletoCreateResponse200, BoletoGetMetadataParam, BoletoGetResponse200, CategoriesListMetadataParam, CategoriesListResponse200, CategoriesRetrieveMetadataParam, CategoriesRetrieveResponse200, CategoriesRetrieveResponse404, ClientCategoryRulesCreateBodyParam, ClientCategoryRulesCreateResponse200, ClientCategoryRulesCreateResponse400, ClientCategoryRulesCreateResponse404, ClientCategoryRulesListResponse200, ConnectTokenCreateBodyParam, ConnectTokenCreateResponse200, ConnectTokenCreateResponse403, ConnectTokenCreateResponse404, ConnectTokenCreateResponse500, ConnectorRetrieveMetadataParam, ConnectorRetrieveResponse200, ConnectorRetrieveResponse404, ConnectorsListMetadataParam, ConnectorsListResponse200, ConnectorsValidateBodyParam, ConnectorsValidateMetadataParam, ConnectorsValidateResponse200, ConsentRetrieveMetadataParam, ConsentRetrieveResponse200, ConsentRetrieveResponse404, ConsentRetrieveResponse500, ConsentsListMetadataParam, ConsentsListResponse200, ConsentsListResponse400, ConsentsListResponse500, IdentityFindByItemMetadataParam, IdentityFindByItemResponse200, IdentityFindByItemResponse400, IdentityFindByItemResponse404, IdentityFindByItemResponse500, IdentityRetrieveMetadataParam, IdentityRetrieveResponse200, IdentityRetrieveResponse400, IdentityRetrieveResponse404, IdentityRetrieveResponse500, InvestmentTransactionsListMetadataParam, InvestmentTransactionsListResponse200, InvestmentTransactionsListResponse500, InvestmentsListMetadataParam, InvestmentsListResponse200, InvestmentsRetrieveMetadataParam, InvestmentsRetrieveResponse200, InvestmentsRetrieveResponse404, ItemsCreateBodyParam, ItemsCreateResponse200, ItemsCreateResponse400, ItemsCreateResponse409, ItemsCreateResponse500, ItemsDeleteMetadataParam, ItemsDeleteResponse200, ItemsDeleteResponse404, ItemsDeleteResponse500, ItemsDisableAutosyncMetadataParam, ItemsDisableAutosyncResponse200, ItemsDisableAutosyncResponse404, ItemsDisableAutosyncResponse500, ItemsRetrieveMetadataParam, ItemsRetrieveResponse200, ItemsRetrieveResponse404, ItemsRetrieveResponse500, ItemsSendMfaBodyParam, ItemsSendMfaMetadataParam, ItemsSendMfaResponse200, ItemsSendMfaResponse404, ItemsSendMfaResponse500, ItemsUpdateBodyParam, ItemsUpdateMetadataParam, ItemsUpdateResponse200, ItemsUpdateResponse400, ItemsUpdateResponse404, ItemsUpdateResponse409, ItemsUpdateResponse500, LoansListMetadataParam, LoansListResponse200, LoansRetrieveMetadataParam, LoansRetrieveResponse200, LoansRetrieveResponse404, PaymentCustomerCreateBodyParam, PaymentCustomerCreateResponse200, PaymentCustomerCreateResponse400, PaymentCustomerDeleteMetadataParam, PaymentCustomerDeleteResponse404, PaymentCustomerRetrieveMetadataParam, PaymentCustomerRetrieveResponse200, PaymentCustomerRetrieveResponse404, PaymentCustomerUpdateBodyParam, PaymentCustomerUpdateMetadataParam, PaymentCustomerUpdateResponse200, PaymentCustomersListMetadataParam, PaymentCustomersListResponse200, PaymentIntentCreateBodyParam, PaymentIntentCreateResponse200, PaymentIntentRetrieveMetadataParam, PaymentIntentRetrieveResponse200, PaymentIntentRetrieveResponse404, PaymentIntentsListMetadataParam, PaymentIntentsListResponse200, PaymentRecipientCreateBodyParam, PaymentRecipientCreateResponse200, PaymentRecipientCreateResponse400, PaymentRecipientDeleteMetadataParam, PaymentRecipientDeleteResponse404, PaymentRecipientInstitutionsRetrieveMetadataParam, PaymentRecipientInstitutionsRetrieveResponse200, PaymentRecipientInstitutionsRetrieveResponse404, PaymentRecipientRetrieveMetadataParam, PaymentRecipientRetrieveResponse200, PaymentRecipientRetrieveResponse404, PaymentRecipientUpdateBodyParam, PaymentRecipientUpdateMetadataParam, PaymentRecipientUpdateResponse200, PaymentRecipientsInstitutionListMetadataParam, PaymentRecipientsInstitutionListResponse200, PaymentRecipientsListMetadataParam, PaymentRecipientsListResponse200, PaymentRequestCreateBodyParam, PaymentRequestCreatePixQrBodyParam, PaymentRequestCreatePixQrResponse200, PaymentRequestCreateResponse200, PaymentRequestDeleteMetadataParam, PaymentRequestDeleteResponse404, PaymentRequestRetrieveMetadataParam, PaymentRequestRetrieveResponse200, PaymentRequestRetrieveResponse404, PaymentRequestUpdateBodyParam, PaymentRequestUpdateMetadataParam, PaymentRequestUpdateResponse200, PaymentRequestsListResponse200, PaymentSchedulesCancelMetadataParam, PaymentSchedulesCancelSpecificMetadataParam, PaymentSchedulesListMetadataParam, PaymentSchedulesListResponse200, SmartTranfersPreauthorizationsListMetadataParam, SmartTranfersPreauthorizationsListResponse200, SmartTransferPaymentCreateBodyParam, SmartTransferPaymentCreateResponse200, SmartTransferPaymentCreateResponse400, SmartTransferPaymentretrieveMetadataParam, SmartTransferPaymentretrieveResponse200, SmartTransferPaymentretrieveResponse404, SmartTransferPreauthorizationCreateBodyParam, SmartTransferPreauthorizationCreateResponse200, SmartTransferPreauthorizationCreateResponse400, SmartTransferPreauthorizationRetrieveMetadataParam, SmartTransferPreauthorizationRetrieveResponse200, SmartTransferPreauthorizationRetrieveResponse404, TransactionsListMetadataParam, TransactionsListResponse200, TransactionsListResponse400, TransactionsListResponse500, TransactionsRetrieveMetadataParam, TransactionsRetrieveResponse200, TransactionsRetrieveResponse404, TransactionsRetrieveResponse500, TransactionsUpdateBodyParam, TransactionsUpdateMetadataParam, TransactionsUpdateResponse200, TransactionsUpdateResponse400, TransactionsUpdateResponse404, TransactionsUpdateResponse500, WebhooksCreateBodyParam, WebhooksCreateResponse201, WebhooksCreateResponse400, WebhooksCreateResponse500, WebhooksDeleteMetadataParam, WebhooksDeleteResponse200, WebhooksDeleteResponse404, WebhooksDeleteResponse500, WebhooksListResponse200, WebhooksListResponse500, WebhooksRetrieveMetadataParam, WebhooksRetrieveResponse200, WebhooksRetrieveResponse404, WebhooksRetrieveResponse500, WebhooksUpdateBodyParam, WebhooksUpdateMetadataParam, WebhooksUpdateResponse200, WebhooksUpdateResponse400, WebhooksUpdateResponse404, WebhooksUpdateResponse500 } from './types';
