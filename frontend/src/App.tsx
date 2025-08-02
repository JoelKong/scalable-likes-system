import { useState, useEffect } from "react";

interface Post {
  id: number;
  content: string;
  likeCount: number;
  isLiked: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function App() {
  const [post, setPost] = useState<Post>({
    id: 123,
    content: "This is a sample post to test the scalable likes system",
    likeCount: 0,
    isLiked: false,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial like count on component mount
  useEffect(() => {
    fetchLikeCount();
  }, []);

  const fetchLikeCount = async () => {
    try {
      const response = await fetch(`${API_URL}/like/count/${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setPost((prev) => ({ ...prev, likeCount: data.count }));
      }
    } catch (error) {
      console.error("Failed to fetch like count:", error);
    }
  };

  const handleLike = async () => {
    if (isLoading) return;

    setIsLoading(true);

    // Store previous state for rollback
    const previousState = { ...post };

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
          user_id: 1, // Assuming everyone is user ID 1 for test
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setPost(previousState);
        throw new Error("Failed to like post");
      }

      const result = await response.json();

      // Update with the actual count from Redis
      if (result.likeCount !== undefined) {
        setPost((prev) => ({
          ...prev,
          likeCount: result.likeCount,
        }));
      }
    } catch (error) {
      console.error("Error liking post:", error);
      // Revert to previous state on error
      setPost(previousState);
    } finally {
      setIsLoading(false);
    }
  };

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
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                post.isLiked
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } ${
                isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <svg
                className={`w-5 h-5 ${
                  post.isLiked ? "fill-current" : "stroke-current fill-none"
                }`}
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>{post.isLiked ? "Unlike" : "Like"}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Real-time likes powered by Redis & Kafka</p>
          <p className="mt-1">Post ID: {post.id} | User ID: 1</p>
          <p className="mt-1">API: {API_URL}</p>
        </div>
      </div>
    </div>
  );
}
