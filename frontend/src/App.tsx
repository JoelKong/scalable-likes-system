import { useState, useEffect } from "react";

interface Post {
  id: number;
  content: string;
  likeCount: number;
  isLiked: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CURRENT_USER_ID = 1; // In a real app, this would come from authentication

export default function App() {
  const [post, setPost] = useState<Post>({
    id: 123,
    content: "This is a sample post to test the scalable likes system",
    likeCount: 0,
    isLiked: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Fetch initial like count and user status on component mount
  useEffect(() => {
    fetchLikeCountAndStatus();
  }, []);

  const fetchLikeCountAndStatus = async () => {
    try {
      setIsInitialLoading(true);
      const response = await fetch(
        `${API_URL}/like/count/${post.id}?userId=${CURRENT_USER_ID}`
      );
      if (response.ok) {
        const data = await response.json();
        setPost((prev) => ({
          ...prev,
          likeCount: data.count,
          isLiked: data.isLiked || false,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch like count and status:", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleLike = async () => {
    if (isLoading) return;

    setIsLoading(true);

    // Store previous state for rollback
    const previousState = { ...post };

    // Optimistic update
    setPost((prev) => ({
      ...prev,
      likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
      isLiked: !prev.isLiked,
    }));

    try {
      const response = await fetch(`${API_URL}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: post.id,
          user_id: CURRENT_USER_ID,
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setPost(previousState);
        throw new Error("Failed to like post");
      }

      const result = await response.json();

      // Update with the actual state from the response
      setPost((prev) => ({
        ...prev,
        isLiked: result.isLiked,
      }));

      // Refetch the count to ensure consistency
      setTimeout(() => {
        fetchLikeCountAndStatus();
      }, 500); // Small delay to allow Kafka processing
    } catch (error) {
      console.error("Error liking post:", error);
      // Revert to previous state on error
      setPost(previousState);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Sample Post</h2>
            <p className="text-gray-600 mt-2">{post.content}</p>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">
              {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
            </span>

            <button
              onClick={handleLike}
              disabled={isLoading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 transform hover:scale-105 ${
                post.isLiked
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-lg"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } ${
                isLoading
                  ? "opacity-50 cursor-not-allowed scale-100"
                  : "cursor-pointer"
              }`}
            >
              <svg
                className={`w-5 h-5 transition-all duration-200 ${
                  post.isLiked
                    ? "fill-current text-white transform scale-110"
                    : "stroke-current fill-none"
                } ${isLoading ? "animate-pulse" : ""}`}
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="font-medium">
                {isLoading ? "..." : post.isLiked ? "Unlike" : "Like"}
              </span>
            </button>
          </div>

          {/* Status indicator */}
          <div className="mt-3 text-xs text-center">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1 ${
                post.isLiked ? "bg-red-500" : "bg-gray-400"
              }`}
            ></span>
            <span className="text-gray-500">
              {post.isLiked ? "You liked this post" : "Not liked"}
            </span>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Real-time likes powered by Redis & Kafka</p>
          <p className="mt-1">
            Post ID: {post.id} | User ID: {CURRENT_USER_ID}
          </p>
          <p className="mt-1">API: {API_URL}</p>
        </div>
      </div>
    </div>
  );
}
