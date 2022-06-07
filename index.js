/**
 * Created By,
 * Muhammad Zahid 20-04-2022
 * email : zahidnasim@live.com
 * ===========================
 * Including config to use in the code 
 */

 const dotenv = require('dotenv').config();
 const express = require('express');
 const app = express();
 const crypto = require('crypto');
 const cookie = require('cookie');
 const nonce = require( 'nonce')();
 const querystring = require('querystring');
 const request = require('request-promise');
 const apiKey = process.env.SHOPIFY_API_KEY;
 const apiSecret = process.env.SHOPIFY_API_SECRET;
 const scopes = 'write_products,read_orders,write_orders,read_products,write_products,read_draft_orders,write_draft_orders';
 const forwardingAddress = "https://f159-101-53-236-162.in.ngrok.io"; // Repl
 const mysql = require('mysql');


/**
 * DB connection 
 */

 var pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "joeyco_live_db",
    multipleStatements: true
});  


 
/**
 * index url for testing
 */

app.get('/', (req, res) => {   
    res.send('Hello world!');
});

/**
 * url for shopify app
 */

 app.get('/shopify',(req,res) => {
    const shop = req.query.shop;
    if (shop) {
        const state = nonce();
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop + '/admin/oauth/authorize?client_id=' + apiKey +
        '&scope=' + scopes + 
        '&state='+ state +
        '&redirect_uri=' + redirectUri;
        res.cookie('state', state);
        res. redirect(installUrl);        
    } else {
        return res.status(400).send('missing shop parameter. Please add shop')
    }
    
});

/**
 * call back url for shopify app to install
 */

 app.get('/shopify/callback',(req,res) => {
    const { shop, hmac, code, state } = req.query;
    const stateCookie = cookie. parse(req.headers.cookie).state;
    if(state !== stateCookie) {
        return res.status (483).send('Request origin cannot be verified');
    }
    if (shop && hmac && code) {
        const map = Object.assign({}, req.query);
        delete map['hmac'];
        const message = querystring.stringify(map);
        const generatedHash = crypto
        .createHmac('sha256', apiSecret)
        .update(message)
        .digest('hex');
        console.log(hmac,generatedHash);
        /**
         * matching hash and hmac
         */

        if(generatedHash !== hmac) {
            return res.status(400).send('MAC validation failed');
        }
        const accessTokenRequestUrl = 'https://'+shop +'/admin/oauth/access_token';
        const accessTokenPayload =  {
            client_id :apiKey,
            client_secret :apiSecret,
            code            
        }

        /**
         * checking if app is already installed on shop 
         */

        const vendor_exist_sql = "SELECT id FROM vendors WHERE domain_name ='"+shop+"'";
        pool.getConnection(function(err,con){
            con.query(vendor_exist_sql,function(err,result_vendor_exist){
                con.release();
                if (err) throw err;
                if(result_vendor_exist && result_vendor_exist.length){
                    console.log(result_vendor_exist);
                    return res.status (400).send('App already installed on this client.');
                }
                else{

                    /**
                     * Validating request to receive access token
                     */
                    
                    request.post(accessTokenRequestUrl, {json: accessTokenPayload })
                    .then((accessTokenResponse) => {
                        const accessToken = accessTokenResponse.access_token;
                        const apiRequestUrl ='https://' + shop + '/admin/api/2022-01/webhooks.json';
                        const apiRequestHeader = {
                            'X-Shopify-Access-Token' : accessToken
                        }

                        /**
                         * Retrieving shops data 
                         */

                        var result = "some text";
                        const apiRequestShopUrl='https://' + shop + '/admin/api/2022-01/shop.json';
                        request.get(apiRequestShopUrl, { headers: apiRequestHeader })
                        .then((apiResponse) =>{
                            var shop_data = JSON.parse(apiResponse);
                            result = shop_data.shop; 
                            // console.log(result);

                            /**
                             * Inserting vendor data on installing shopify app 
                             */

                            //inserting into sprint__contacts and contacts_enc
                            const sql_contact = "INSERT INTO sprint__contacts(name, phone, email) VALUES ('"+result.name+"','"+result.phone+"','"+result.email+"');INSERT INTO contacts_enc(name, phone, email) VALUES (AES_ENCRYPT('"+result.name+"','application.35e63cdfa435b91a','application.972666bfd2523371'),AES_ENCRYPT('"+result.phone+"','application.35e63cdfa435b91a','application.972666bfd2523371'),AES_ENCRYPT('"+result.email+"','application.35e63cdfa435b91a','application.972666bfd2523371'))";
                            con.query(sql_contact,[1,2], function (err, result_contact) {
                                if (err) throw err;
                                // console.log(result_contact[1].insertId);
                                //inserting into vendors
                                const sql_vendor = "INSERT INTO vendors(group_id,package_id,first_name,last_name,description,email,PASSWORD,password_expiry_token,admin_password,phone,website,NAME,location_id,contact_id,business_phone,business_suite,business_address,business_city,business_state,business_country,business_postal_code,latitude,longitude,shipping_policy,return_policy,contactus,logo,banner,logo_old,video,url,prep_time,vehicle_id,default_merchant_delivery,is_enabled,is_display,is_registered,is_online,is_store_open,is_newsletter,is_customer_email_receipt,pwd_reset_token,pwd_reset_token_expiry,approved_at,tutorial_at,deleted_at,created_at,updated_at,email_verify_token,payment_method,api_key,is_mediator,sms_printer_number,timezone,is_ghost,searchables,tags,printer_fee,salesforce_id,password_expires_at,CODE,code_updated,forgot_code,pay_commission,is_joey_payout,googlecode,ip_address,order_load,with_hub,joey_order_capacity_per_task,joey_order_count,reattempts,reattempt_rate,order_start_time,order_end_time,vendor_quiz_limit,emailauthanticationcode,customLatitude,customLongitude,invoice_number,tax_id,payer_account,freight_rate,order_count,score,TYPE,domain_name) VALUES (NULL,'28839','"+result.name+"','"+result.name+"','When you eat at Fat Bastard Burrito, you`ll taste the long hours we put into perfecting our craft','"+result.email+"','$2a$08$0gADKRpbU3j2vMbc4PW0yemTzfT0W5xvxCbtJcy9EzimM7ukmYakC','sptyjAcoqIPCZzciEsrlsLLq8hwxtFYB',NULL,'+14167262950','"+result.domain+"','"+result.name+"','2663136','"+result_contact[1].insertId+"',+16473524555,NULL,'"+result.address1+"','"+result.city+"','"+result.country_code+"','"+result.country+"','"+result.zip+"','"+result.latitude+"','"+result.longitude+"',NULL,NULL,NULL,'afc5JERFZBTg3EM5M5Uay7JrX76EQbwD','15zbCXZqn4oktBj21tp6fSriXcbzikZy',NULL,NULL,NULL,'20',3,0,1,0,1,'1','0','1','0',NULL,NULL,'2015-10-13 17:30:35',NULL,NULL,'2015-10-09 20:59:37','2020-09-19 04:00:06','0fd50c12949f32e92cd3337a7e68625b','cc',NULL,'0',NULL,'America/Toronto','0','Fat Bastard Burrito Co. - Queen St W burrito, mexican, wraps, burritos, chipotle Restaurant Sandwiches Fast Food Wraps Burritos Mexican','burrito, mexican, wraps, burritos, chipotle','0.00','0011500001M7lhi','2018-06-23 04:00:00','111111','2030-02-09 00:00:00',NULL,'0',0,NULL,NULL,'0',0,'0',0,0,'0',NULL,'0',0,NULL,NULL,NULL,'1','0',NULL,'0',NULL,NULL,NULL,'"+shop+"')";
                                con.query(sql_vendor, function(err, result_vendor) {
                                    if (err) throw err;
                                    // console.log(result_vendor);
                                });
                            });
                        })
                        .catch((error) =>{
                            res.status(error.statusCode).end(error.error.error_description);
                        });

                        /**
                         * Creating Webhook for order creation
                         */

                        var options = {
                            'method': 'POST',
                            'url': apiRequestUrl,
                            'headers': {
                            'X-Shopify-Access-Token': accessToken,
                            'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                            "webhook": {
                                "topic": "orders/create",
                                "address": "https://yourstocksolution.000webhostapp.com/shopify/orders.php",
                                "format": "json",
                                // "fields": [
                                //     "id",
                                //     "note",
                                //     "customer",
                                //     "fulfillments"
                                // ]
                                }
                            })
                        };
                        request(options, function (error, response) {
                            if (error) throw new Error(error);
                            res.send(response.body);
                        });
                    })
                    .catch((error) => {
                        res.status(error.statusCode).send(error.error.error_description);
                    });
                }
            })
        });
    } 
    else {
        res.status(400).send('Required paraneters nissing');
    }    
});

app.listen (3000, () => {
    console.log("App is listenin at port 3000");
});