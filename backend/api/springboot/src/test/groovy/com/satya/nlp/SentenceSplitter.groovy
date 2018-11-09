package com.satya.nlp

import spock.lang.Specification

/**
 * Created by Anoop Singh on 12/21/2016.
 */
class SentenceSplitterSpec extends  Specification{

    def "text containing sentences well separated by full stop"(numOfSentences, text, desc){
        expect: "$desc"
            new SentenceSplitter().getSentences(text).size() == numOfSentences

        where:
            numOfSentences | text | desc
            2 | """This is a sample sentence, containing just some info. This is another sentence well separated by full stop.""" | "well formed"
            2 | """This is a sample sentence, containing just some info.This is another sentence well separated by full stop""" | "not well formed"
            2 | """Your credit card was used to purchase using Rs 50.00 at airtel.This is just a notification""" | "containing decimal point"
            2 | """Your credit card was used to purchase using Rs. 50.00 at airtel.This is just a notification""" | "containing abbreviation"
            1 | """Your credit card was used to purchase using Rs. 50.00 at Airtel.This is just a notification""" | "containing abbreviation"
            3 | """An amount of INR 15,000.00 has been debited to your A/C. No. XX7326 on 19-DEC-16 11:00:02- on account of LT CHQ WITHDRAWAL,SOHNA ROAD

Available Balance on 19-Dec-16 11:00:08 is INR 1,356.30 and Total available balance (including linked deposits and Limit) is INR 1,356.30.

For any clarifications contact us at 18002000 (Toll Free).

""" | "yesbanks"
             5 | """This service is a part of our constant endeavor to deliver Superior Customer Service Experience to our valued customers. At YES BANK, we value your feedback. Please write to us at yestouch@yesbank.in, contact your relationship manager or visit your nearest branch. If you would like to view any other details regarding your account, please login to our Retail Net Banking service at http://www.yesbank.in This is a system generated message. Please do not reply to this e-mail.""" | "yesbnk"
    }

}

class SentenceSplitter{

    def getSentences(String text){
        int index = 0
        def sentences = []
        def sentence = ""
        def consumeSentence = {
            sentences << sentence
            sentence = ""
        }

        def representsAbbreviation = { i ->
            String token = ""
            while (i >= 0 && text[i] != ' '){
                token = text[i] + token
                i--
            }
            boolean isToken = token =~ /[A-Z].*/
//            if(i+1 < text.length()) { isToken &= (text[i+1] == ' ') }

            if(isToken) {
                return true
            }
        }

        text.eachWithIndex{ currentSynbol, int i ->
            index = i;
            def nextSymbol = i+1 <= text.length()-1 ? text[i+1] : " "

            if(currentSynbol == "\n"){
                consumeSentence()
            }
            else if("." == currentSynbol){
                boolean shouldConsume = nextSymbol =~ /[A-Z\s]/
                if(representsAbbreviation(index)) shouldConsume = false

                if(shouldConsume){
                    consumeSentence()
                } else {
                    sentence += currentSynbol
                }

            } else { sentence += currentSynbol}

        }
        if(sentence.trim() != "") sentences << sentence
        return sentences.findAll { it.trim().size() > 0}
    }
}
