"use strict";

const router = require("express").Router();
const Tweet = require("../models/tweet");
const User = require("../models/user");
const userRoutes = require("./user.js");

function log(err){
    console.error(err); 
}

function findUserTweets(user){
    User.findOne({ username: user }, (err, profile) => {
        if(err){

            log("Error finding user: " + err);
            
        } else {
            // If User Found in DB
            console.log(profile);
            if(profile) {

                // Find Users Tweets
                Tweet.find({user: {id: profile._id, username: profile.username}}, (err, usersTweets) =>{

                    if(err){
                        log("Error finding tweets from user: " + err);
                    } else {
                        // Return Users Tweets if found
                        return usersTweets;
                    }

                });

            } else {
                // Return null if no user found
                return null;
            }
        }

    });
}


/* show home page */
router.get("/", function(req, res) {
    res.render("landing");
});

router.route("/tweets")
// INDEX - show all tweets
.get((req, res) => {
    //
    if (req.query.search) {

        console.log(req.query.search);
        
        // Find User & Tweets in DB
        var UsersTweets = findUserTweets(req.query.search);
        if(UsersTweets != null | undefined){
            // User & Tweets Found, Sort them & display on index page
            UsersTweets = (req.query.sortByDate == "1" ? oldestTweetsByDate(UsersTweets) : latestTweetsByDate(UsersTweets));
            res.render("index", { tweets: UsersTweets });
        } else {
            // No user found in DB, so find all tweets with specific searched string
            
            var pattern = ".*" + escapeRegex(req.query.search) + ".*";
            console.log(pattern);

            var regex = new RegExp(pattern, "gi");

            
            Tweet.find({ tweet: regex }, (err, allTweets) => {

                if (err) {
                    log(err);
                } else {
                    
                    // Sort Tweets by Date
                    allTweets = latestTweetsByDate(allTweets);
                    res.render("index", { tweets: allTweets });

                }
            });
        }

    } else {
        // No search query, Find all tweets
        // Eventually find only tweets from those who the user follows
        Tweet.find({}, function(err, allTweets) {
            if (err) {
                log(err);
            } else {
                // Sort tweets by date
                allTweets = latestTweetsByDate(allTweets);
                res.render("index", { tweets: allTweets });
            }
        });
    }
})

// CREATE - add new tweet to DB
.post(isLoggedIn, (req, res) => {
    const newTweet = { tweet: req.body.tweet };
    User.findOne({"username": res.locals.currentUser.username},  function(err, profile){
        if(err){
            log(err);
            res.redirect("/tweets");
        } else {
            // Increment tweets on profile 
            var tweetAmnt = profile.meta.tweets + 1;
            profile.meta.tweets = tweetAmnt;
            profile.save();
            // Create a new tweet
            Tweet.create(newTweet, function(err, tweet) {
                if (err) {
                    console.log(err);
                    res.redirect("/tweets");
                } else {
                    // Add user information to tweet (id, username)
                    tweet.user.id = res.locals.currentUser._id;
                    tweet.user.username = res.locals.currentUser.username;
                    tweet.save();
                    res.redirect("/tweets");
                }
            });
        } 
    });
         
});

// DELETE - delete tweet from DB using MongoDB ID
router.delete("/tweets/:id", isLoggedIn, function(req, res) {
    // Find the Tweet in the Database and remove it
    // /tweets/:id is the route that we are using to delete tweets
    // You get the :id from the route using "req.params.id"
    Tweet.findById(req.params.id, function(err, tweet) {
        if (err) {
            console.log("Error finding Tweet : " + err);
            res.redirect("/tweets");
        } else {
            // Check to make sure the currentUser trying to delete tweet is the creator
            if (res.locals.currentUser.username == tweet.user.username) {
                tweet.remove();
                console.log("Tweet Deleted");
                
                User.findOne({ username: res.locals.currentUser.username }, (err, profile) => {
                    if(err){
                        // Error Grabbing Profile
                        console.log("Error Grabbing Profile for Deletion : " + err);
                        res.redirect("/tweets");
                    } else {
                        // Decrement tweets in profile
                        if(profile.meta.tweets > 0){
                            var tweetAmnt = (profile.meta.tweets - 1);
                            profile.meta.tweets = tweetAmnt;
                            profile.save();
                        }
                        res.redirect("/tweets");
                    }
                }); 
            }
        }
    });
});

// INCLUDE USER ROUTES from user.js file
router.use("/", userRoutes);

// Sort tweets array by date (Latest First)
function latestTweetsByDate(allTweets){
    allTweets.sort(function(a, b) { return (a.date < b.date) ? 1 : ((a.date > b.date) ? -1 : 0); });
    return allTweets;
}

// Sort tweets array by date (Oldest First)
function oldestTweetsByDate(allTweets){
    allTweets.sort(function(a, b){ return (a.date < b.date) ? -1 : ((a.date > b.date) ? 1 : 0); });
    return allTweets;
}

// Check if loggedin MIDDLEWARE
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
} 

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;