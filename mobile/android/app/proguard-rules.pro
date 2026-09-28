# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# SignalR
-keep class com.microsoft.signalr.** { *; }
-dontwarn com.microsoft.signalr.**

# Expo & React Native
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keep class com.facebook.react.** { *; }
-keep class expo.modules.** { *; }

