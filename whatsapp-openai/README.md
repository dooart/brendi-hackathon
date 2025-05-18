# Hackathon Starter - Whatsapp & OpenAI

For running a whatsapp bot with local code (development environment), you will need to follow the steps below.


=== STEP 1 ===
1.1 Create an account in https://www.z-api.io/, 
1.2 Create a free instance
1.3 Connect the whatsapp of one member of the group (as you would in the whatsapp web app)
1.4 Create a group with the other member of your group

Ps: one will be the assistent, the other will be the user

=== STEP 2 ===

2.1 Create an account in n8n 
2.2 Create one workflow
2.3 Setup a webhook trigger. 
2.3.1 Get the webhook TEST URL and paste in the z-api instance configs in the "ao receber" area
2.4 Create an IF filter in n8n that will filter the chatName by your group name (exactly, so the agent only works inside your group)
2.5 Connect the true part of the IF operator to an HTTP request (POST)
2.5.1 Organize the body to send at least: the phone and the message based on the input fields

=== STEP 3 ===

3.1 Open the repository in the whatsapp-openai paste
3.2 Copy the instanceID, Token and ClientID to the utils file from your Z-api account (security Tab)
3.3 Setup the .env file with the openAI apiKey

=== STEP 4 ===

4.1 Download and install ngrok (https://ngrok.com/)
4.2 Run `npm i` in your terminal already in the whatsapp-openai paste
4.3 Run `npm start` in your terminal so you start serving the api
4.4 Run `ngrok http 3000` in your terminal, in order to get the api endpoint Public URL
4.5 Copy this URL and paste as the destination in the n8n workflow on the third step, the HTTP POST Request
4.6 Click in "test workflow" and send a message as a user (the whatsapp NOT connected to Z-api)

=== STEP 5 ===

5.1 Copy the Webhook trigger production URL to the z-api webhook configs
5.2 Activate your workflow in n8n so the messages start being processed
5.3 Test it!


After this, you can chande the code for the api and the generate message as you need. You only need to re-run the `npm start` command in order to your changed be applied to you chatbot!