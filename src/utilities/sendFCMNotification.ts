import { getMessaging } from 'firebase-admin/messaging'
import { cert, initializeApp, getApps, ServiceAccount } from 'firebase-admin/app'
import serviceAccountKey from '../../serviceAccountKey.json'

type NotificationData = {
  id?: string
  title: string
  body: string
  imageUrl?: string
  link?: string
}

type SendFCMNotificationParams = {
  tokens: string[]
  notification: NotificationData
}

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccountKey as ServiceAccount),
  })
}

export const sendFCMNotification = async ({
  tokens,
  notification,
}: SendFCMNotificationParams): Promise<void> => {
  try {
    if (!tokens.length) {
      console.log('No FCM tokens provided')
      return
    }

    const messaging = getMessaging()
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        link: notification.link || '',
      },
      tokens,
    }

    const response = await messaging.sendEachForMulticast(message)

    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((resp, idx) => (resp.success ? null : tokens[idx]))
        .filter((token): token is string => token !== null)

      console.error('Failed to send notifications to tokens:', failedTokens)
    }

    console.log(
      `Successfully sent ${response.successCount} notifications, failed: ${response.failureCount}`,
    )
  } catch (error) {
    console.error('Error sending FCM notification:', error)
    throw error
  }
}
export const sendFCMTopicNotification = async ({
  topic,
  notification,
}: {
  topic: string
  notification: NotificationData
}): Promise<void> => {
  try {
    if (!topic) {
      console.log('No topic provided')
      return
    }

    const messaging = getMessaging()
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        link: notification.link || '',
        topic: topic,
        id: notification.id?.toString() || '',
      },
      topic,
    }

    const response = await messaging.send(message)
    console.log('Successfully sent message:', response)
  } catch (error) {
    console.error('Error sending FCM topic notification:', error)
    throw error
  }
}
