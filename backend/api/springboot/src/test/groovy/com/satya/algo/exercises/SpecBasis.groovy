package com.satya.algo.exercises

import spock.lang.Specification

/**
 * Created by Anoop Singh on 12/17/2016.
 */
class SpecBasis extends Specification{
    def setup(){
        List.metaClass.allSubsequences {
            int powOfTwo = 1 << delegate.size()
            (0..powOfTwo-1).collect{ positionsOfOneInBinaryFormOf(it)}.collect { it.collect { i -> delegate[i-1]}}
        }
    }

    def positionsOfOneInBinaryFormOf(int number) {
        def out = []
        int lim = Math.ceil(Math.log(number) / Math.log(2))
        (0..lim).each { i ->
            def powOfTwo = (1 << i)
            boolean conditionIsTrue = (number & powOfTwo ) == powOfTwo
            if(conditionIsTrue) out << (i+1)
        }
        return out
    }
}
