
    const firebaseConfig = {
      apiKey: "AIzaSyBV7Il02QKJm5ySV7mkxRIGk174KIDlgzQ",
      authDomain: "song-snap.firebaseapp.com",
      databaseURL: "https://song-snap-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "song-snap",
      storageBucket: "song-snap.appspot.com",
      messagingSenderId: "222199242127",
      appId: "1:222199242127:web:b0917cd835ccfbddf27ffa",
      measurementId: "G-R08D0MSK2P"
    };

    let fb = firebase.initializeApp(firebaseConfig);
    let auth = firebase.auth();

          // FirebaseUI config.
          var uiConfig = {
        signInOptions: [
          // Leave the lines as is for the providers you want to offer your users.
          firebase.auth.GoogleAuthProvider.PROVIDER_ID,
          firebase.auth.EmailAuthProvider.PROVIDER_ID,
          firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
        ],
        // tosUrl and privacyPolicyUrl accept either url string or a callback
        // function.
        // Terms of service url/callback.
        tosUrl: '<your-tos-url>',
        // Privacy policy url/callback.
        privacyPolicyUrl: function() {
          window.location.assign('<your-privacy-policy-url>');
        }
      };

      // Initialize the FirebaseUI Widget using Firebase.
      var ui = new firebaseui.auth.AuthUI(auth);
      // The start method will wait until the DOM is loaded.
      ui.start('#firebaseui-auth-container', uiConfig);
      
      var userData = null;

      window.addEventListener('DOMContentLoaded', function() {
            $("#loaded").show();
          firebase.auth().onAuthStateChanged(function(user) {
          console.log("Auth state changed");
          window.user = user;
          UpdateAuthContent();
        }, function(error) {
          console.log(error);
        });
      });

      function UpdateAuthContent(){
          if (user) {
              $("#provideUserName").show();  
              $("#user-signed-out").hide();
              $("#user-signed-in").show();
              SetUserLoggedId();
          } 
          else 
          {
            $("#user-signed-in").hide();
            $("#user-signed-out").show();
          }
        }