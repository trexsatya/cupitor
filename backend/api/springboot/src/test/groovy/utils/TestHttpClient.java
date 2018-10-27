package utils;

import org.apache.commons.io.IOUtils;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.conn.ssl.SSLContextBuilder;
import org.apache.http.conn.ssl.TrustStrategy;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestTemplate;


import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

/**
 * Created by kumatye on 14-09-2017.
 */
public class TestHttpClient {

    private static final org.slf4j.Logger logger = LoggerFactory.getLogger(TestHttpClient.class);

     static CloseableHttpClient apacheHttpClient() throws Exception{
            SSLContext sslContext = new SSLContextBuilder()
                    .loadTrustMaterial(null, new TrustStrategy() {
                        public boolean isTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                            return true;
                        }
                    }).build();

//            CredentialsProvider credsProvider = new BasicCredentialsProvider();

            CloseableHttpClient httpClient = HttpClients.custom()
                    .setSSLContext(sslContext)
                    .setSSLHostnameVerifier(new NoopHostnameVerifier())
                    .build();

            HttpClientContext context = HttpClientContext.create();
//            context.setCredentialsProvider(credsProvider);

         return httpClient;
    }

    static RestTemplate springRestTemplate(String... headers) throws Exception{
        HttpComponentsClientHttpRequestFactory requestFactory
                = new HttpComponentsClientHttpRequestFactory();
        requestFactory.setHttpClient(apacheHttpClient());

        RestTemplate template = new RestTemplate(requestFactory);
        template.setErrorHandler(new ResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse clienthttpresponse) throws IOException {
                if (clienthttpresponse.getStatusCode() != HttpStatus.OK) {
                    logger.debug("Status code: " + clienthttpresponse.getStatusCode());
                    logger.debug("Response" + clienthttpresponse.getStatusText());

                    if (clienthttpresponse.getStatusCode() == HttpStatus.FORBIDDEN) {
                        logger.debug("Call returned a error 403 forbidden resposne ");
                        return true;
                    }
                }
                return false;
            }

            @Override
            public void handleError(ClientHttpResponse clientHttpResponse) throws IOException {
                String resp = IOUtils.toString(clientHttpResponse.getBody());
                System.out.println(resp);
            }
        });

        List<ClientHttpRequestInterceptor> interceptors = new ArrayList<>();
        interceptors.add(new HeaderRequestInterceptor(headers));
        template.setInterceptors(interceptors);

        return template;
    }

    static class HeaderRequestInterceptor implements ClientHttpRequestInterceptor {

        private String[] headerNames = new String[]{};

        private String[] headerValues = new String[]{};

        HeaderRequestInterceptor(String... headers) {
              if(headers.length > 0){
                  headerNames = new String[headers.length];
                  headerValues = new String[headers.length];

                  int i= 0 ;
                  for(String header: headers){
                      String[] splits = header.split(":");
                      headerNames[i] = splits[0].trim();
                      headerValues[i] = splits[1].trim();
                      i++;
                  }
              }
        }

        @Override
        public ClientHttpResponse intercept(HttpRequest httpRequest, byte[] body, ClientHttpRequestExecution clientHttpRequestExecution) throws IOException {
            for (int i = 0; i < headerNames.length; i++) {
                String headerName = headerNames[i];
                String headerValue = headerValues[i];
                httpRequest.getHeaders().set(headerName, headerValue);
            }
            return clientHttpRequestExecution.execute(httpRequest, body);
        }
    }

}