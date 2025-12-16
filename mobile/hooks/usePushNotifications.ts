
import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerDeviceToken } from '../api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  const registerForPushNotificationsAsync = async () => {
    let token;
    if (!Constants.isDevice) {
      console.log("Must use physical device for Push Notifications");
      // Alert.alert("Push notifications are only available on physical devices.");
      return;
    }

    const permResult: any = await Notifications.getPermissionsAsync();
    // older/newer versions of expo-notifications may return different shapes
    let finalStatus: any = permResult.status ?? (permResult.granted ? 'granted' : 'denied');

    if (finalStatus !== 'granted') {
      const req: any = await Notifications.requestPermissionsAsync();
      finalStatus = req.status ?? (req.granted ? 'granted' : finalStatus);
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Failed to get push token for push notification!');
      return;
    }
    
    // Get the Expo Push Token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      // If no projectId is found, getExpoPushTokenAsync might fail or warn depending on version
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.error("Failed to get Expo Push Token", e);
      return;
    }
    

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (token) {
        setExpoPushToken(token);
        // Send the token to your backend
        try {
            await registerDeviceToken(token);
            console.log("Successfully registered device token to backend:", token);
        } catch (error) {
            console.error("Failed to register device token with backend:", error);
            // You might want to retry this silently in the background later
        }
    }
  };

  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // Listener for user interacting with notification (tapping it)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("User tapped notification:", response);
      // Handle navigation or other logic here
    });

    return () => {
      if (notificationListener.current) {
        // `Subscription` returned by addNotificationReceivedListener has a `remove()` method
        // calling it directly is the supported way to unsubscribe.
        try {
          notificationListener.current.remove();
        } catch (e) {
          // fallback: if remove isn't available, attempt the older Notifications API
          // (keeps compatibility with different expo-notifications versions)
          // @ts-ignore
          Notifications.removeNotificationSubscription?.(notificationListener.current as any);
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove();
        } catch (e) {
          // @ts-ignore
          Notifications.removeNotificationSubscription?.(responseListener.current as any);
        }
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    registerForPushNotificationsAsync,
  };
};
