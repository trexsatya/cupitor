package com.satya.algo.exercises

/**
 * Created by Anoop Singh on 12/18/2016.
 */
class AvgSumOfAllSubsets {
    def "sum of averages of all subsets of given set"(set, sum){
        expect:
            avgSumOfSubsetsOf(set) == sum

        where:
            set | sum
            [2,3,5] | 23.33

    }

    def avgSumOfSubsetsOf(List set) {
        def sol = []
        //state[i] = solution including element[i]
        sol[0] = set[0]
        sol[1] = set[0]
    }
}
