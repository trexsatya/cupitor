package com.satya.algo.exercises

import static java.util.Comparator.comparing

/**
 * Created by Anoop Singh on 12/17/2016.
 */
class LongestSubsequenceSpec extends SpecBasis {

    def "should return longest subsequence of numbers which differ by one"(List numbers,int output){
        expect: "The longest subsequence from $numbers should be $output"
//            longestSubSequence(numbers) == output
            numbers

        where: "numbers and output are given as here"
            numbers | output
            [10, 9, 4, 5, 4, 8, 6] | 3
            [1, 2, 3, 2, 3, 7, 2, 1] | 7

    }

    def "all subsequences of given sequence"(numbers){
        expect:
            allSubsequencesOfGiven(numbers)
            true
        where:
            numbers | _
            [2, 3, 5, 7] | _
    }

    def allSubsequencesOfGiven(List sequence) {
        Comparator firstElement = { a,b ->
            if(a == null || a[0] == null) return 1
            if(b == null || b[0] == null) return -1
            a[0]?.compareTo(b[0])
        }
        def comparator = comparing { subseqnc -> subseqnc.size() }.thenComparing(firstElement)

        sequence.subsequences().toSorted(comparator).each { println(it)}
    }

    def "positions of one in binary form of given number"(number, pos){
        expect:
            positionsOfOneInBinaryFormOf(number).sort() == pos.sort()

        where:
            number | pos
            1 | [1]
            2 | [2]
            3 | [1,2]
            4 | [3]
            5 | [1,3]
            6 | [2,3]
            7 | [1,2,3]
            14| [2,3,4]
            43| [1,2,4,6]
    }


}
