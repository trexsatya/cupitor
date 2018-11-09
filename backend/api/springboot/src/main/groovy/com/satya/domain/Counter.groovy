package com.satya.domain

import org.springframework.data.annotation.Id;

public class Counter {
    @Id private String id;
    private int seq;
}