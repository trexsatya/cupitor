package com.satya;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter
import org.springframework.web.filter.OncePerRequestFilter

import javax.servlet.FilterChain
import javax.servlet.ServletException
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse;


@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(securedEnabled = true,prePostEnabled = true)
class SecurityConfiguration extends WebSecurityConfigurerAdapter {

    @Value("\${users:}")
    private String[] userList

    /**
     * This section defines the user accounts which can be used for
     * authentication as well as the roles each user has.
     */
    @Override
    void configure(AuthenticationManagerBuilder auth) throws Exception {

        Arrays.asList(userList).forEach({ userString ->
            def (name, password, roles) = userString.split(":")

            roles = roles.split("-")
    
            auth.inMemoryAuthentication()
                    .withUser(name).password(password).roles(roles)
        })

    }

    /**
     * This section defines the security policy for the app.
     * - BASIC authentication is supported (enough for this REST-based demo)
     * - /employees is secured using URL security shown below
     * - CSRF headers are disabled since we are only testing the REST interface,
     *   not a web one.
     *
     * NOTE: GET is not shown which defaults to permitted.
     */
    @Override
    protected void configure(HttpSecurity http) throws Exception {

        http
                .httpBasic().and()
                .authorizeRequests()
                .antMatchers(HttpMethod.POST, "/api/article").hasRole("ADMIN")
                .antMatchers(HttpMethod.PUT, "/api/article/**").hasRole("ADMIN")
                .antMatchers(HttpMethod.PATCH, "/api/article/**").hasRole("ADMIN")
                .antMatchers(HttpMethod.GET, "/api/notepadData").hasRole("ADMIN")
                .and()
                .csrf().disable().addFilterBefore(new HeaderBasedAuthFilter(userList), BasicAuthenticationFilter.class)
    }
}

class HeaderBasedAuthFilter extends OncePerRequestFilter {
    def userList = list

    HeaderBasedAuthFilter(list){
        this.userList = list
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String xAuth = request.getHeader("X-Auth")
        if(xAuth == null) xAuth = " - "

//        if(isValid(xAuth) == false){
//            throw new SecurityException()
//        }

        // The token is 'valid' so magically get a user id from it

        def (username, password) = xAuth.split("-")

        // Create our Authentication and let Spring know about it

        //TODO: use UserDetailsService to load granted authorities

        def authenticatedUser = Arrays.asList(userList).find({ userString ->
            def (name, pwd, roles) = userString.split(":")
            name == username && password == pwd
        })

        if(authenticatedUser){
            def (name, pwd, roles) = authenticatedUser.split(":")

            /** Somehow authentication manager configured is not inferring roles for Spring Data requests.
                So need to pass authorities, which will be tested against @PreAuthorize etc
            **/

            Authentication auth = new UsernamePasswordAuthenticationToken(username, password, 
                roles.split("-").collect{ new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+it) }
                )
            SecurityContextHolder.getContext().setAuthentication(auth)

            println "Auth: $auth"
        }

        filterChain.doFilter(request, response)
    }
}